create table public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.schedule_assignments(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  suggested_user_id uuid references public.profiles(id),
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, status)
);

create index swap_requests_assignment_idx on public.swap_requests(assignment_id, status);
create index swap_requests_suggested_user_idx on public.swap_requests(suggested_user_id, status);

create or replace function public.confirm_schedule_assignment(target_assignment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.schedule_assignments
  set status = 'confirmed', responded_at = now(), updated_at = now()
  where id = target_assignment_id and user_id = (select auth.uid());
  if not found then raise exception 'Escala não encontrada ou sem permissão.'; end if;
end;
$$;

create or replace function public.request_assignment_swap(
  target_assignment_id uuid,
  target_suggested_user_id uuid default null,
  swap_reason text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  requester_id uuid := (select auth.uid());
  target_department_id uuid;
  request_id uuid;
begin
  select ds.department_id into target_department_id
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.id = target_assignment_id and sa.user_id = requester_id;
  if target_department_id is null then raise exception 'Escala não encontrada ou sem permissão.'; end if;
  if target_suggested_user_id is not null and not exists (
    select 1 from public.department_memberships
    where department_id = target_department_id and user_id = target_suggested_user_id and status = 'active'
  ) then raise exception 'A pessoa indicada não pertence a este setor.'; end if;

  insert into public.swap_requests (assignment_id, requested_by, suggested_user_id, reason)
  values (target_assignment_id, requester_id, target_suggested_user_id, nullif(trim(swap_reason), ''))
  returning id into request_id;
  update public.schedule_assignments set status = 'replacement_requested', responded_at = now(), updated_at = now()
  where id = target_assignment_id;
  return request_id;
end;
$$;

revoke all on function public.confirm_schedule_assignment(uuid) from public;
revoke all on function public.request_assignment_swap(uuid, uuid, text) from public;
grant execute on function public.confirm_schedule_assignment(uuid) to authenticated;
grant execute on function public.request_assignment_swap(uuid, uuid, text) to authenticated;

alter table public.swap_requests enable row level security;
create policy "swap requests visible to participants and leaders"
on public.swap_requests for select to authenticated
using (
  requested_by = (select auth.uid())
  or suggested_user_id = (select auth.uid())
  or exists (
    select 1 from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.departments d on d.id = ds.department_id
    where sa.id = assignment_id
      and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin(d.church_id))
  )
);
