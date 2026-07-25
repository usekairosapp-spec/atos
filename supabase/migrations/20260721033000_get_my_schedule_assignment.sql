create or replace function public.get_my_schedule_assignment(target_schedule_id uuid)
returns table (assignment_id uuid, assignment_status public.assignment_status)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.status
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and ds.status = 'published'
  limit 1;
$$;

revoke all on function public.get_my_schedule_assignment(uuid) from public;
grant execute on function public.get_my_schedule_assignment(uuid) to authenticated;
