create or replace function public.create_church_with_admin(church_name text, church_slug text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  new_church_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores da plataforma podem criar igrejas.';
  end if;

  if char_length(trim(church_name)) < 2 then
    raise exception 'Nome da igreja inválido.';
  end if;

  insert into public.churches (name, slug)
  values (trim(church_name), church_slug)
  returning id into new_church_id;

  insert into public.church_memberships (church_id, user_id, role, status)
  values (new_church_id, (select auth.uid()), 'church_admin', 'active');

  return new_church_id;
end;
$$;

revoke all on function public.create_church_with_admin(text, text) from public;
grant execute on function public.create_church_with_admin(text, text) to authenticated;
