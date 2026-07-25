drop policy if exists "memberships managed by church admin" on public.church_memberships;
drop policy if exists "department memberships managed by leaders" on public.department_memberships;
drop policy if exists "notifications updated by owner" on public.notifications;

create or replace function public.assign_department_membership(target_department_id uuid, target_user_id uuid, target_role public.department_role)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_church_id uuid;
begin
  select church_id into target_church_id from public.departments where id = target_department_id and active;
  if target_church_id is null or not public.is_church_admin(target_church_id) then raise exception 'Sem permissão para atribuir este setor.'; end if;
  if not exists (select 1 from public.church_memberships where church_id = target_church_id and user_id = target_user_id and status = 'active') then raise exception 'A pessoa não é membro ativo desta igreja.'; end if;
  insert into public.department_memberships (department_id, user_id, role, status)
  values (target_department_id, target_user_id, target_role, 'active')
  on conflict (department_id, user_id) do update set role = excluded.role, status = 'active', updated_at = now();
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns void language sql security definer set search_path = ''
as $$ update public.notifications set read_at = coalesce(read_at, now()) where id = target_notification_id and user_id = (select auth.uid()); $$;

create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = ''
as $$ update public.notifications set read_at = coalesce(read_at, now()) where user_id = (select auth.uid()) and read_at is null; $$;

create or replace function public.confirm_schedule_assignment(target_assignment_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.schedule_assignments sa set status = 'confirmed', responded_at = now(), updated_at = now()
  from public.department_schedules ds
  where sa.id = target_assignment_id and sa.department_schedule_id = ds.id
    and sa.user_id = (select auth.uid()) and sa.status = 'pending' and ds.status = 'published';
  if not found then
    if exists (select 1 from public.schedule_assignments where id = target_assignment_id and user_id = (select auth.uid()) and status = 'confirmed') then return; end if;
    raise exception 'Esta participação não está disponível para confirmação.';
  end if;
end;
$$;

create or replace function public.request_assignment_swap(target_assignment_id uuid, target_suggested_user_id uuid default null, swap_reason text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare requester_id uuid := (select auth.uid()); target_department_id uuid; target_church_id uuid; target_schedule_id uuid; request_id uuid; current_status public.assignment_status; event_start timestamptz; event_end timestamptz;
begin
  select ds.department_id, d.church_id, ds.id, sa.status, s.starts_at, s.ends_at
  into target_department_id, target_church_id, target_schedule_id, current_status, event_start, event_end
  from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id
  where sa.id = target_assignment_id and sa.user_id = requester_id and sa.status in ('pending', 'confirmed') and ds.status = 'published'
  for update of sa;
  if target_department_id is null then raise exception 'Escala não encontrada ou indisponível para troca.'; end if;
  if target_suggested_user_id is null or target_suggested_user_id = requester_id then raise exception 'Selecione outra pessoa para a troca.'; end if;
  if not exists (select 1 from public.department_memberships dm join public.church_memberships cm on cm.user_id = dm.user_id and cm.church_id = target_church_id and cm.status = 'active' where dm.department_id = target_department_id and dm.user_id = target_suggested_user_id and dm.status = 'active') then raise exception 'A pessoa escolhida não está ativa neste setor.'; end if;
  if exists (select 1 from public.schedule_assignments where department_schedule_id = target_schedule_id and user_id = target_suggested_user_id) then raise exception 'A pessoa escolhida já está nesta escala.'; end if;
  if exists (
    select 1 from public.schedule_assignments other_sa join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id join public.services other_s on other_s.id = other_ds.service_id
    where other_sa.user_id = target_suggested_user_id and other_ds.status = 'published' and other_sa.status in ('pending','confirmed','replacement_requested')
      and other_s.starts_at < event_end and other_s.ends_at > event_start
  ) then raise exception 'A pessoa escolhida já possui outra escala neste horário.'; end if;
  insert into public.swap_requests (assignment_id, requested_by, suggested_user_id, reason, previous_assignment_status)
  values (target_assignment_id, requester_id, target_suggested_user_id, nullif(trim(swap_reason), ''), current_status) returning id into request_id;
  update public.schedule_assignments set status = 'replacement_requested', responded_at = now(), updated_at = now() where id = target_assignment_id and status = current_status;
  return request_id;
end;
$$;

create or replace function public.respond_to_peer_swap(target_request_id uuid, accept_request boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_assignment_id uuid; recipient_id uuid; prior_status public.assignment_status; target_department_id uuid; target_church_id uuid; target_schedule_id uuid;
begin
  select sr.assignment_id, sr.suggested_user_id, sr.previous_assignment_status, ds.department_id, d.church_id, ds.id
  into target_assignment_id, recipient_id, prior_status, target_department_id, target_church_id, target_schedule_id
  from public.swap_requests sr join public.schedule_assignments sa on sa.id = sr.assignment_id join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id
  where sr.id = target_request_id and sr.status = 'pending' and ds.status = 'published'
  for update of sr, sa;
  if target_assignment_id is null or recipient_id <> (select auth.uid()) then raise exception 'Convite de troca não encontrado ou sem permissão.'; end if;
  if accept_request then
    if not exists (select 1 from public.department_memberships dm join public.church_memberships cm on cm.user_id = dm.user_id and cm.church_id = target_church_id and cm.status = 'active' where dm.department_id = target_department_id and dm.user_id = recipient_id and dm.status = 'active') then raise exception 'Você não está mais ativo neste setor.'; end if;
    if exists (select 1 from public.schedule_assignments where department_schedule_id = target_schedule_id and user_id = recipient_id and id <> target_assignment_id) then raise exception 'Você já está nesta escala.'; end if;
    update public.schedule_assignments set user_id = recipient_id, status = 'confirmed', responded_at = now(), updated_at = now() where id = target_assignment_id and status = 'replacement_requested';
    if not found then raise exception 'A participação mudou enquanto a troca era processada.'; end if;
    update public.swap_requests set status = 'accepted', updated_at = now() where id = target_request_id and status = 'pending';
  else
    update public.schedule_assignments set status = prior_status, responded_at = case when prior_status = 'confirmed' then now() else null end, updated_at = now() where id = target_assignment_id and status = 'replacement_requested';
    if not found then raise exception 'A participação mudou enquanto a troca era processada.'; end if;
    update public.swap_requests set status = 'rejected', updated_at = now() where id = target_request_id and status = 'pending';
  end if;
end;
$$;

create or replace function public.add_schedule_assignments(target_schedule_id uuid, selections jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare item jsonb; added integer := 0;
begin
  if jsonb_typeof(selections) <> 'array' or jsonb_array_length(selections) = 0 then raise exception 'Selecione pelo menos uma pessoa.'; end if;
  for item in select * from jsonb_array_elements(selections) loop
    perform public.add_schedule_assignment(target_schedule_id, (item->>'positionId')::uuid, (item->>'userId')::uuid);
    added := added + 1;
  end loop;
  return added;
end;
$$;

drop function if exists public.resolve_assignment_swap(uuid, uuid, boolean);

revoke all on function public.assign_department_membership(uuid, uuid, public.department_role) from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
revoke all on function public.add_schedule_assignments(uuid, jsonb) from public;
grant execute on function public.assign_department_membership(uuid, uuid, public.department_role) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.add_schedule_assignments(uuid, jsonb) to authenticated;
