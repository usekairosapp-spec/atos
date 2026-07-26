create or replace function public.debug_can_view_schedule(target_user_id uuid, target_assignment_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  result json;
  v_schedule_id uuid;
  v_department_id uuid;
  v_church_id uuid;
begin
  select sa.department_schedule_id into v_schedule_id from public.schedule_assignments sa where sa.id = target_assignment_id;
  select ds.department_id into v_department_id from public.department_schedules ds where ds.id = v_schedule_id;
  select d.church_id into v_church_id from public.departments d where d.id = v_department_id;

  perform set_config('request.jwt.claims', json_build_object('sub', target_user_id, 'role', 'authenticated')::text, true);

  select json_build_object(
    'auth_uid_seen', auth.uid(),
    'can_view_schedule', public.can_view_department_schedule(v_schedule_id),
    'is_active_owner', public.is_active_assignment_owner(target_assignment_id),
    'is_church_admin', public.is_church_admin(v_church_id),
    'is_leader', public.is_assigned_department_leader(v_department_id),
    'is_active_member', public.is_active_church_member(v_church_id)
  ) into result;
  return result;
end;
$$;
grant execute on function public.debug_can_view_schedule(uuid, uuid) to authenticated, anon;
