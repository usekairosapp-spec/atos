alter table public.swap_requests
  drop constraint if exists swap_requests_assignment_id_status_key;

create unique index if not exists swap_requests_one_pending_per_assignment_idx
  on public.swap_requests(assignment_id)
  where status = 'pending';

alter table public.swap_requests
  add column if not exists previous_assignment_status public.assignment_status not null default 'pending';

create or replace function public.request_assignment_swap(
  target_assignment_id uuid,
  target_suggested_user_id uuid default null,
  swap_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare requester_id uuid := (select auth.uid()); target_department_id uuid; request_id uuid; current_status public.assignment_status;
begin
  select ds.department_id, sa.status into target_department_id, current_status
  from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.id = target_assignment_id and sa.user_id = requester_id and sa.status in ('pending', 'confirmed');
  if target_department_id is null then raise exception 'Escala não encontrada ou sem permissão.'; end if;
  if target_suggested_user_id is null or target_suggested_user_id = requester_id then raise exception 'Selecione outra pessoa para a troca.'; end if;
  if not exists (select 1 from public.department_memberships where department_id = target_department_id and user_id = target_suggested_user_id and status = 'active') then
    raise exception 'A pessoa escolhida não pertence a este setor.';
  end if;
  insert into public.swap_requests (assignment_id, requested_by, suggested_user_id, reason, previous_assignment_status)
  values (target_assignment_id, requester_id, target_suggested_user_id, nullif(trim(swap_reason), ''), current_status)
  returning id into request_id;
  update public.schedule_assignments set status = 'replacement_requested', responded_at = now(), updated_at = now() where id = target_assignment_id;
  return request_id;
end;
$$;

create or replace function public.respond_to_peer_swap(target_request_id uuid, accept_request boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_assignment_id uuid; recipient_id uuid; prior_status public.assignment_status;
begin
  select assignment_id, suggested_user_id, previous_assignment_status into target_assignment_id, recipient_id, prior_status
  from public.swap_requests where id = target_request_id and status = 'pending';
  if target_assignment_id is null or recipient_id <> (select auth.uid()) then raise exception 'Convite de troca não encontrado ou sem permissão.'; end if;
  if accept_request then
    update public.schedule_assignments set user_id = recipient_id, status = 'confirmed', responded_at = now(), updated_at = now() where id = target_assignment_id;
    update public.swap_requests set status = 'accepted', updated_at = now() where id = target_request_id;
  else
    update public.schedule_assignments set status = prior_status, responded_at = case when prior_status = 'confirmed' then now() else null end, updated_at = now() where id = target_assignment_id;
    update public.swap_requests set status = 'rejected', updated_at = now() where id = target_request_id;
  end if;
end;
$$;
