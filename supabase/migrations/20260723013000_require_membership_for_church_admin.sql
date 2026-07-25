create or replace function public.assign_church_admin(target_church_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas administradores da plataforma podem designar responsáveis.';
  end if;
  if not exists (select 1 from public.churches where id = target_church_id and status = 'active') then
    raise exception 'Igreja não encontrada.';
  end if;
  if exists (select 1 from public.platform_roles where user_id = target_user_id) then
    raise exception 'Administrador da plataforma não pode administrar uma igreja.';
  end if;
  if not exists (
    select 1
    from public.church_memberships
    where church_id = target_church_id
      and user_id = target_user_id
      and status = 'active'
  ) then
    raise exception 'A pessoa precisa entrar e ser aprovada nesta igreja antes de ser definida como responsável.';
  end if;

  update public.church_memberships
  set role = 'member', updated_at = now()
  where church_id = target_church_id
    and role = 'church_admin'
    and user_id <> target_user_id;

  update public.church_memberships
  set role = 'church_admin', updated_at = now()
  where church_id = target_church_id
    and user_id = target_user_id
    and status = 'active';
end;
$$;

revoke all on function public.assign_church_admin(uuid, uuid) from public;
grant execute on function public.assign_church_admin(uuid, uuid) to authenticated;
