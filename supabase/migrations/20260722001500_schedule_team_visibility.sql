create or replace function public.get_schedule_team(target_schedule_id uuid)
returns table (
  assignment_id uuid,
  user_id uuid,
  assignment_status public.assignment_status,
  position_name text,
  member_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, pos.name, p.full_name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where sa.department_schedule_id = target_schedule_id
    and (
      public.is_assigned_department_leader(ds.department_id)
      or public.is_church_admin(d.church_id)
      or exists (
        select 1
        from public.schedule_assignments viewer_assignment
        where viewer_assignment.department_schedule_id = ds.id
          and viewer_assignment.user_id = (select auth.uid())
      )
    )
  order by pos.name, p.full_name;
$$;

revoke all on function public.get_schedule_team(uuid) from public;
grant execute on function public.get_schedule_team(uuid) to authenticated;
