create or replace function public.debug_check_function_owners()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_agg(row_to_json(t)) from (
    select p.proname, r.rolname as owner, r.rolbypassrls, r.rolsuper
    from pg_proc p
    join pg_roles r on r.oid = p.proowner
    where p.proname in ('is_active_schedule_participant', 'can_view_department_schedule', 'is_active_assignment_owner', 'is_church_admin')
      and p.pronamespace = 'public'::regnamespace
  ) t;
$$;
grant execute on function public.debug_check_function_owners() to authenticated, anon;
