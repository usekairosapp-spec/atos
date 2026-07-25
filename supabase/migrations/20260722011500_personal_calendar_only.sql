create or replace function public.get_personal_calendar_assignments(target_church_id uuid)
returns table (
  assignment_id uuid,
  owner_user_id uuid,
  assignment_status public.assignment_status,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  department_name text,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select distinct
    sa.id,
    sa.user_id,
    sa.status,
    ds.id,
    s.title,
    s.starts_at,
    s.ends_at,
    s.location,
    d.name,
    p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.user_id = (select auth.uid())
    and d.church_id = target_church_id
    and ds.status = 'published'
  order by s.starts_at, d.name, p.name;
$$;

revoke all on function public.get_personal_calendar_assignments(uuid) from public;
grant execute on function public.get_personal_calendar_assignments(uuid) to authenticated;
