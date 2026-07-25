do $$
declare
  user_count integer;
  first_user_id uuid;
begin
  select count(*), (array_agg(id))[1] into user_count, first_user_id from auth.users;

  if user_count = 1 then
    insert into public.platform_roles (user_id, role)
    values (first_user_id, 'platform_admin')
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;
