-- Membros e líderes pertencem a uma única igreja.
-- Administradores da igreja continuam sendo tratados separadamente porque podem
-- administrar a implantação de mais de uma igreja sem se tornarem membros delas.

create or replace function public.validate_single_church_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role <> 'member'
    or new.status not in ('pending', 'active') then
    return new;
  end if;

  -- Serializa alterações do mesmo usuário para impedir duas solicitações
  -- simultâneas em igrejas diferentes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 20260725001000)
  );

  if exists (
    select 1
    from public.church_memberships cm
    where cm.user_id = new.user_id
      and cm.id <> new.id
      and cm.church_id <> new.church_id
      and cm.role = 'member'
      and cm.status in ('pending', 'active')
  ) then
    raise exception 'Esta pessoa já pertence ou aguarda aprovação em outra igreja.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_single_church_member_before_write
  on public.church_memberships;
create trigger validate_single_church_member_before_write
before insert or update of church_id, user_id, role, status
on public.church_memberships
for each row execute function public.validate_single_church_member();

create or replace function public.validate_single_church_leader()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id uuid;
begin
  if new.role <> 'leader' or new.status <> 'active' then
    return new;
  end if;

  select d.church_id
  into target_church_id
  from public.departments d
  where d.id = new.department_id
    and d.active;

  if target_church_id is null then
    raise exception 'A equipe selecionada não está ativa.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 20260725001001)
  );

  if exists (
    select 1
    from public.department_memberships dm
    join public.departments d on d.id = dm.department_id
    where dm.user_id = new.user_id
      and dm.id <> new.id
      and dm.role = 'leader'
      and dm.status = 'active'
      and d.church_id <> target_church_id
  ) then
    raise exception 'Esta pessoa já é líder em outra igreja.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_single_church_leader_before_write
  on public.department_memberships;
create trigger validate_single_church_leader_before_write
before insert or update of department_id, user_id, role, status
on public.department_memberships
for each row execute function public.validate_single_church_leader();

create or replace function public.request_church_membership(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id uuid;
  membership_id uuid;
begin
  if actor_id is null then
    raise exception 'Entre na sua conta para solicitar acesso.';
  end if;

  select c.id
  into target_church_id
  from public.churches c
  where c.invite_code = upper(trim(code))
    and c.status = 'active';

  if target_church_id is null then
    raise exception 'Código de igreja inválido.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 20260725001000)
  );

  if exists (
    select 1
    from public.church_memberships cm
    where cm.user_id = actor_id
      and cm.church_id <> target_church_id
      and cm.role = 'member'
      and cm.status in ('pending', 'active')
  ) then
    raise exception 'Sua conta já pertence ou aguarda aprovação em outra igreja.';
  end if;

  insert into public.church_memberships (church_id, user_id, role, status)
  values (target_church_id, actor_id, 'member', 'pending')
  on conflict (church_id, user_id) do update
    set status = case
      when public.church_memberships.status in ('rejected', 'suspended')
        then 'pending'
      else public.church_memberships.status
    end,
    role = case
      when public.church_memberships.role = 'church_admin'
        then public.church_memberships.role
      else 'member'::public.church_role
    end,
    updated_at = now()
  returning id into membership_id;

  return membership_id;
end;
$$;

revoke all on function public.request_church_membership(text) from public;
grant execute on function public.request_church_membership(text) to authenticated;

