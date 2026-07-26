create or replace function public.debug_list_policies(target_table text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_agg(row_to_json(t)) from (
    select polname,
      pg_get_expr(polqual, polrelid) as using_expr,
      case polcmd when 'r' then 'select' when '*' then 'all' when 'w' then 'update' when 'a' then 'insert' when 'd' then 'delete' end as cmd
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    where c.relname = target_table
  ) t;
$$;
grant execute on function public.debug_list_policies(text) to authenticated, anon;
