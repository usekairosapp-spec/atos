create or replace function public.get_my_swap_page_data(target_schedule_id uuid, target_assignment_id uuid)
returns table (
  assignment_id uuid,
  assignment_status public.assignment_status,
  department_id uuid,
  department_name text,
  position_name text,
  service_title text,
  service_starts_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.status, ds.department_id, d.name, p.name, s.title, s.starts_at
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  join public.services s on s.id = ds.service_id
  where sa.id = target_assignment_id
    and sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and sa.status in ('pending', 'confirmed')
    and ds.status = 'published'
  limit 1;
$$;

revoke all on function public.get_my_swap_page_data(uuid, uuid) from public;
grant execute on function public.get_my_swap_page_data(uuid, uuid) to authenticated;
