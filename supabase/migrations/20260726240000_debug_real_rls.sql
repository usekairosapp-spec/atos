create or replace function public.debug_real_rls_query(target_user_id uuid)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', target_user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select jsonb_agg(row_to_json(t)) into result from (
    select sa.id as assignment_id, sa.status as assignment_status, sa.department_schedule_id,
           ds.status as schedule_status, ds.id as schedule_visible
    from public.schedule_assignments sa
    left join public.department_schedules ds on ds.id = sa.department_schedule_id
    where sa.user_id = target_user_id
  ) t;
  reset role;
  return result;
end;
$$;
grant execute on function public.debug_real_rls_query(uuid) to authenticated, anon;
