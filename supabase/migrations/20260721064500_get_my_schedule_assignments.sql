create or replace function public.get_my_schedule_assignments(target_church_id uuid)
returns table (
  department_schedule_id uuid,
  user_id uuid,
  assignment_status public.assignment_status,
  position_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sa.department_schedule_id,
    sa.user_id,
    sa.status,
    p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.user_id = (select auth.uid())
    and d.church_id = target_church_id
    and ds.status = 'published'
  order by sa.created_at;
$$;

revoke all on function public.get_my_schedule_assignments(uuid) from public;
grant execute on function public.get_my_schedule_assignments(uuid) to authenticated;
