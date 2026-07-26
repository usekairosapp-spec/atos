create or replace function public.debug_isolated_test(target_user_id uuid, which text)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', target_user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if which = 'schedule_assignments_only' then
    select jsonb_agg(row_to_json(t)) into result from (
      select id, status, department_schedule_id from public.schedule_assignments where user_id = target_user_id
    ) t;
  elsif which = 'department_schedules_only' then
    select jsonb_agg(row_to_json(t)) into result from (
      select id, status from public.department_schedules
    ) t;
  end if;

  reset role;
  return result;
exception when others then
  reset role;
  return jsonb_build_object('error', SQLERRM, 'state', SQLSTATE);
end;
$$;
grant execute on function public.debug_isolated_test(uuid, text) to authenticated, anon;
