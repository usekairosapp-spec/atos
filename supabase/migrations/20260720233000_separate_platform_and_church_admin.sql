alter table public.profiles add column email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

drop policy "profiles read self or church colleagues" on public.profiles;
create policy "profiles read self church colleagues or platform admin" on public.profiles
for select to authenticated using (
  id = (select auth.uid())
  or public.is_platform_admin()
  or exists (
    select 1
    from public.church_memberships theirs
    where theirs.user_id = profiles.id
      and (
        public.is_church_admin(theirs.church_id)
        or exists (
          select 1 from public.church_memberships mine
          where mine.church_id = theirs.church_id
            and mine.user_id = (select auth.uid())
            and mine.status = 'active'
            and theirs.status = 'active'
        )
      )
  )
);

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

  return new_church_id;
end;
$$;

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
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Usuário não encontrado.';
  end if;
  if exists (select 1 from public.platform_roles where user_id = target_user_id) then
    raise exception 'Administrador da plataforma não pode administrar uma igreja.';
  end if;

  insert into public.church_memberships (church_id, user_id, role, status)
  values (target_church_id, target_user_id, 'church_admin', 'active')
  on conflict (church_id, user_id) do update
    set role = 'church_admin', status = 'active', updated_at = now();
end;
$$;

revoke all on function public.assign_church_admin(uuid, uuid) from public;
grant execute on function public.assign_church_admin(uuid, uuid) to authenticated;

delete from public.department_memberships
where user_id in (select user_id from public.platform_roles);

delete from public.church_memberships
where user_id in (select user_id from public.platform_roles);
