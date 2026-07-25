create type public.schedule_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.assignment_status as enum ('pending', 'confirmed', 'declined', 'replacement_requested', 'replaced');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.department_schedules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  status public.schedule_status not null default 'draft',
  created_by uuid not null references public.profiles(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, department_id)
);

create table public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  department_schedule_id uuid not null references public.department_schedules(id) on delete cascade,
  position_id uuid not null references public.positions(id),
  user_id uuid not null references public.profiles(id),
  status public.assignment_status not null default 'pending',
  assigned_by uuid not null references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_schedule_id, position_id, user_id)
);

create index services_church_start_idx on public.services(church_id, starts_at);
create index department_schedules_department_idx on public.department_schedules(department_id, status);
create index department_schedules_service_idx on public.department_schedules(service_id);
create index schedule_assignments_user_idx on public.schedule_assignments(user_id, status);
create index schedule_assignments_schedule_idx on public.schedule_assignments(department_schedule_id);

create or replace function public.is_active_department_member(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.department_memberships
    where department_id = target_department_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.create_department_schedule(
  target_department_id uuid,
  schedule_title text,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_location text,
  schedule_notes text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  target_church_id uuid;
  new_service_id uuid;
  new_schedule_id uuid;
begin
  if not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder atribuído pode criar escalas para este setor.';
  end if;
  if schedule_ends_at <= schedule_starts_at then
    raise exception 'O horário final deve ser posterior ao inicial.';
  end if;
  select church_id into target_church_id from public.departments where id = target_department_id and active;
  if target_church_id is null then raise exception 'Setor não encontrado.'; end if;

  insert into public.services (church_id, title, starts_at, ends_at, location, notes, created_by)
  values (target_church_id, trim(schedule_title), schedule_starts_at, schedule_ends_at, nullif(trim(schedule_location), ''), nullif(trim(schedule_notes), ''), (select auth.uid()))
  returning id into new_service_id;

  insert into public.department_schedules (service_id, department_id, created_by)
  values (new_service_id, target_department_id, (select auth.uid()))
  returning id into new_schedule_id;

  return new_schedule_id;
end;
$$;

create or replace function public.add_schedule_assignment(
  target_schedule_id uuid,
  target_position_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
  new_assignment_id uuid;
begin
  select department_id into target_department_id from public.department_schedules where id = target_schedule_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para alterar esta escala.';
  end if;
  if not exists (select 1 from public.positions where id = target_position_id and department_id = target_department_id and active) then
    raise exception 'Função inválida para este setor.';
  end if;
  if not exists (select 1 from public.department_memberships where department_id = target_department_id and user_id = target_user_id and status = 'active') then
    raise exception 'A pessoa precisa ser membro ativo do setor.';
  end if;

  insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
  values (target_schedule_id, target_position_id, target_user_id, (select auth.uid()))
  returning id into new_assignment_id;
  return new_assignment_id;
end;
$$;

create or replace function public.publish_department_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
begin
  select department_id into target_department_id from public.department_schedules where id = target_schedule_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para publicar esta escala.';
  end if;
  if not exists (select 1 from public.schedule_assignments where department_schedule_id = target_schedule_id) then
    raise exception 'Adicione pelo menos uma pessoa antes de publicar.';
  end if;
  update public.department_schedules set status = 'published', published_at = now(), updated_at = now() where id = target_schedule_id;
end;
$$;

create or replace function public.can_view_department_schedule(target_schedule_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    where ds.id = target_schedule_id
      and (
        public.is_church_admin(d.church_id)
        or public.is_assigned_department_leader(ds.department_id)
        or exists (
          select 1 from public.schedule_assignments sa
          where sa.department_schedule_id = ds.id and sa.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function public.is_active_department_member(uuid) from public;
revoke all on function public.create_department_schedule(uuid, text, timestamptz, timestamptz, text, text) from public;
revoke all on function public.add_schedule_assignment(uuid, uuid, uuid) from public;
revoke all on function public.publish_department_schedule(uuid) from public;
revoke all on function public.can_view_department_schedule(uuid) from public;
grant execute on function public.is_active_department_member(uuid) to authenticated;
grant execute on function public.create_department_schedule(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.add_schedule_assignment(uuid, uuid, uuid) to authenticated;
grant execute on function public.publish_department_schedule(uuid) to authenticated;
grant execute on function public.can_view_department_schedule(uuid) to authenticated;

alter table public.services enable row level security;
alter table public.department_schedules enable row level security;
alter table public.schedule_assignments enable row level security;

create policy "services read by schedule viewers" on public.services for select to authenticated
using (exists (select 1 from public.department_schedules ds where ds.service_id = id and public.can_view_department_schedule(ds.id)));

create policy "department schedules read by authorized users" on public.department_schedules for select to authenticated
using (public.can_view_department_schedule(id));

create policy "assignments read by authorized users" on public.schedule_assignments for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.department_schedules ds
    where ds.id = department_schedule_id
      and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin((select d.church_id from public.departments d where d.id = ds.department_id)))
  )
);
