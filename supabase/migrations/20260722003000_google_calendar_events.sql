create table public.google_calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assignment_id uuid not null references public.schedule_assignments(id) on delete cascade,
  google_event_id text not null,
  html_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, assignment_id),
  unique (user_id, google_event_id)
);

alter table public.google_calendar_events enable row level security;

create policy "calendar events read own" on public.google_calendar_events
for select to authenticated using (user_id = (select auth.uid()));

create policy "calendar events insert own" on public.google_calendar_events
for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.schedule_assignments sa
    where sa.id = assignment_id
      and sa.user_id = (select auth.uid())
      and sa.status = 'confirmed'
  )
);

create policy "calendar events update own" on public.google_calendar_events
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "calendar events delete own" on public.google_calendar_events
for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.get_my_calendar_event_data(target_assignment_id uuid)
returns table (
  assignment_id uuid,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  service_notes text,
  department_name text,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, ds.id, s.title, s.starts_at, s.ends_at, s.location, s.notes, d.name, p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.id = target_assignment_id
    and sa.user_id = (select auth.uid())
    and sa.status = 'confirmed'
    and ds.status = 'published'
  limit 1;
$$;

revoke all on function public.get_my_calendar_event_data(uuid) from public;
grant execute on function public.get_my_calendar_event_data(uuid) to authenticated;
