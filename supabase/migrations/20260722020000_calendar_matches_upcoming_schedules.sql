create or replace function public.get_personal_calendar_month(
  target_church_id uuid,
  target_month date
)
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
  position_name text,
  google_html_link text
)
language sql stable security definer set search_path = ''
as $$
  select
    sa.id,
    sa.user_id,
    sa.status,
    ds.id,
    s.title,
    s.starts_at,
    s.ends_at,
    s.location,
    d.name,
    p.name,
    gce.html_link
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  left join public.google_calendar_events gce
    on gce.assignment_id = sa.id and gce.user_id = sa.user_id
  where sa.user_id = (select auth.uid())
    and sa.status in ('pending', 'confirmed', 'replacement_requested')
    and d.church_id = target_church_id
    and ds.status = 'published'
    and s.ends_at >= now()
    and s.starts_at >= (date_trunc('month', target_month::timestamp) at time zone 'America/Sao_Paulo')
    and s.starts_at < ((date_trunc('month', target_month::timestamp) + interval '1 month') at time zone 'America/Sao_Paulo')
  order by s.starts_at, d.name, p.name;
$$;

revoke all on function public.get_personal_calendar_month(uuid, date) from public;
grant execute on function public.get_personal_calendar_month(uuid, date) to authenticated;
