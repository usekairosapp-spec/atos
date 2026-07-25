create or replace function public.request_assignment_swap(
  target_assignment_id uuid,
  target_suggested_user_id uuid default null,
  swap_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare requester_id uuid := (select auth.uid()); target_department_id uuid; request_id uuid;
begin
  select ds.department_id into target_department_id
  from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.id = target_assignment_id and sa.user_id = requester_id
    and sa.status in ('pending', 'confirmed');
  if target_department_id is null then raise exception 'Escala não encontrada ou sem permissão.'; end if;
  if target_suggested_user_id is null or target_suggested_user_id = requester_id then
    raise exception 'Selecione outra pessoa para a troca.';
  end if;
  if not exists (select 1 from public.department_memberships where department_id = target_department_id and user_id = target_suggested_user_id and status = 'active') then
    raise exception 'A pessoa escolhida não pertence a este setor.';
  end if;
  insert into public.swap_requests (assignment_id, requested_by, suggested_user_id, reason)
  values (target_assignment_id, requester_id, target_suggested_user_id, nullif(trim(swap_reason), '')) returning id into request_id;
  update public.schedule_assignments set status = 'replacement_requested', responded_at = now(), updated_at = now() where id = target_assignment_id;
  return request_id;
end;
$$;

create or replace function public.respond_to_peer_swap(target_request_id uuid, accept_request boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_assignment_id uuid; requester_id uuid; recipient_id uuid;
begin
  select assignment_id, requested_by, suggested_user_id into target_assignment_id, requester_id, recipient_id
  from public.swap_requests where id = target_request_id and status = 'pending';
  if target_assignment_id is null or recipient_id <> (select auth.uid()) then
    raise exception 'Convite de troca não encontrado ou sem permissão.';
  end if;
  if accept_request then
    update public.schedule_assignments set user_id = recipient_id, status = 'confirmed', responded_at = now(), updated_at = now()
    where id = target_assignment_id;
    update public.swap_requests set status = 'accepted', updated_at = now() where id = target_request_id;
  else
    update public.schedule_assignments set status = 'confirmed', responded_at = now(), updated_at = now()
    where id = target_assignment_id;
    update public.swap_requests set status = 'rejected', updated_at = now() where id = target_request_id;
  end if;
end;
$$;

create or replace function public.can_view_department_schedule(target_schedule_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.department_schedules ds join public.departments d on d.id = ds.department_id
    where ds.id = target_schedule_id and (
      public.is_church_admin(d.church_id) or public.is_assigned_department_leader(ds.department_id)
      or exists (select 1 from public.schedule_assignments sa where sa.department_schedule_id = ds.id and sa.user_id = (select auth.uid()))
      or exists (select 1 from public.swap_requests sr join public.schedule_assignments sa on sa.id = sr.assignment_id where sa.department_schedule_id = ds.id and sr.suggested_user_id = (select auth.uid()) and sr.status = 'pending')
    )
  );
$$;

create or replace function public.can_view_schedule_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.department_schedules ds where ds.service_id = target_service_id and public.can_view_department_schedule(ds.id));
$$;

drop policy if exists "assignments read by authorized users" on public.schedule_assignments;
create policy "assignments read by authorized users" on public.schedule_assignments for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.swap_requests sr where sr.assignment_id = id and sr.suggested_user_id = (select auth.uid()) and sr.status = 'pending')
  or exists (select 1 from public.department_schedules ds join public.departments d on d.id = ds.department_id where ds.id = department_schedule_id and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin(d.church_id)))
);

revoke all on function public.request_assignment_swap(uuid, uuid, text) from public;
revoke all on function public.respond_to_peer_swap(uuid, boolean) from public;
grant execute on function public.request_assignment_swap(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_peer_swap(uuid, boolean) to authenticated;
