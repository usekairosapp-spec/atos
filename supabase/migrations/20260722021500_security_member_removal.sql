create or replace function public.is_active_church_member(target_church_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.church_memberships cm
    join public.churches c on c.id = cm.church_id
    where cm.church_id = target_church_id
      and cm.user_id = (select auth.uid())
      and cm.status = 'active'
      and c.status = 'active'
  );
$$;

create or replace function public.is_church_admin(target_church_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.church_memberships cm
    join public.churches c on c.id = cm.church_id
    where cm.church_id = target_church_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'church_admin'
      and cm.status = 'active'
      and c.status = 'active'
  );
$$;

create or replace function public.is_assigned_department_leader(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.department_memberships dm
    join public.departments d on d.id = dm.department_id
    join public.church_memberships cm on cm.church_id = d.church_id and cm.user_id = dm.user_id
    join public.churches c on c.id = d.church_id
    where dm.department_id = target_department_id
      and dm.user_id = (select auth.uid())
      and dm.role = 'leader'
      and dm.status = 'active'
      and cm.status = 'active'
      and c.status = 'active'
      and d.active
  );
$$;

create or replace function public.is_active_department_member(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.department_memberships dm
    join public.departments d on d.id = dm.department_id
    join public.church_memberships cm on cm.church_id = d.church_id and cm.user_id = dm.user_id
    join public.churches c on c.id = d.church_id
    where dm.department_id = target_department_id
      and dm.user_id = (select auth.uid())
      and dm.status = 'active'
      and cm.status = 'active'
      and c.status = 'active'
      and d.active
  );
$$;

create or replace function public.is_department_leader(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_church_admin(d.church_id)
    or public.is_assigned_department_leader(target_department_id)
  from public.departments d
  join public.churches c on c.id = d.church_id and c.status = 'active'
  where d.id = target_department_id and d.active;
$$;

create or replace function public.validate_department_membership_tenant()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare target_church_id uuid;
begin
  -- Revogações precisam continuar possíveis depois que o vínculo da igreja foi suspenso/excluído.
  if new.status <> 'active' then
    return new;
  end if;
  select church_id into target_church_id from public.departments where id = new.department_id and active;
  if target_church_id is null or not exists (
    select 1
    from public.church_memberships cm
    join public.churches c on c.id = cm.church_id
    where cm.church_id = target_church_id
      and cm.user_id = new.user_id
      and cm.status = 'active'
      and c.status = 'active'
  ) then
    raise exception 'A pessoa precisa ser membro ativo da mesma igreja.';
  end if;
  if new.role = 'leader'
    and not (tg_op = 'UPDATE' and old.role = 'leader' and old.department_id = new.department_id and old.user_id = new.user_id)
    and not public.is_church_admin(target_church_id) then
    raise exception 'Apenas a administradora da igreja pode designar líderes.';
  end if;
  return new;
end;
$$;

create or replace function public.review_church_membership(
  target_membership_id uuid,
  decision public.membership_status
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target_church_id uuid;
  target_user_id uuid;
  target_role public.church_role;
begin
  select church_id, user_id, role
  into target_church_id, target_user_id, target_role
  from public.church_memberships
  where id = target_membership_id
  for update;

  if target_church_id is null or not public.is_church_admin(target_church_id) then
    raise exception 'Sem permissão para revisar este membro.';
  end if;
  if decision not in ('active', 'rejected', 'suspended') then
    raise exception 'Decisão inválida.';
  end if;
  if target_role = 'church_admin' or exists (select 1 from public.platform_roles where user_id = target_user_id) then
    raise exception 'Administradores não podem ser alterados por este fluxo.';
  end if;

  update public.church_memberships
  set status = decision, updated_at = now()
  where id = target_membership_id;
end;
$$;

create or replace function public.revoke_department_access_on_church_membership()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  revoked_church_id uuid;
  revoked_user_id uuid;
begin
  if tg_op = 'DELETE' then
    revoked_church_id := old.church_id;
    revoked_user_id := old.user_id;
  else
    revoked_church_id := new.church_id;
    revoked_user_id := new.user_id;
  end if;
  if tg_op = 'DELETE' or (old.status = 'active' and new.status <> 'active') then
    update public.department_memberships dm
    set status = 'suspended', updated_at = now()
    from public.departments d
    where dm.department_id = d.id
      and d.church_id = revoked_church_id
      and dm.user_id = revoked_user_id
      and dm.status = 'active';
  end if;
  return null;
end;
$$;

drop trigger if exists revoke_department_access_after_membership_change on public.church_memberships;
create trigger revoke_department_access_after_membership_change
after update of status or delete on public.church_memberships
for each row execute function public.revoke_department_access_on_church_membership();

create or replace function public.get_schedule_team(target_schedule_id uuid)
returns table (
  assignment_id uuid,
  user_id uuid,
  assignment_status public.assignment_status,
  position_name text,
  member_name text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, pos.name, p.full_name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.churches c on c.id = d.church_id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where sa.department_schedule_id = target_schedule_id
    and c.status = 'active'
    and (
      public.is_assigned_department_leader(ds.department_id)
      or public.is_church_admin(d.church_id)
      or (
        ds.status = 'published'
        and exists (
          select 1
          from public.schedule_assignments viewer_assignment
          join public.church_memberships viewer_membership
            on viewer_membership.church_id = d.church_id
           and viewer_membership.user_id = (select auth.uid())
           and viewer_membership.status = 'active'
          where viewer_assignment.department_schedule_id = ds.id
            and viewer_assignment.user_id = (select auth.uid())
            and viewer_assignment.status in ('pending', 'confirmed', 'replacement_requested')
        )
      )
    )
  order by pos.name, p.full_name;
$$;

create or replace function public.remove_church_member(target_membership_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_church_id uuid;
  target_user_id uuid;
  target_role public.church_role;
  target_status public.membership_status;
  removed_assignments integer := 0;
  removal_event_key text;
begin
  select cm.church_id, cm.user_id, cm.role, cm.status
  into target_church_id, target_user_id, target_role, target_status
  from public.church_memberships cm
  where cm.id = target_membership_id
  for update;

  if target_church_id is null then
    raise exception 'Membro não encontrado.';
  end if;
  if not exists (
    select 1 from public.church_memberships actor
    join public.churches c on c.id = actor.church_id
    where actor.church_id = target_church_id
      and actor.user_id = actor_id
      and actor.role = 'church_admin'
      and actor.status = 'active'
      and c.status = 'active'
  ) then
    raise exception 'Apenas a administradora ativa da igreja pode remover membros.';
  end if;
  if target_user_id = actor_id or target_role = 'church_admin' then
    raise exception 'Não é permitido remover a administradora da igreja por este fluxo.';
  end if;
  if exists (select 1 from public.platform_roles where user_id = target_user_id) then
    raise exception 'Não é permitido remover a administradora da plataforma.';
  end if;
  if target_status <> 'active' then
    raise exception 'Somente membros ativos podem ser removidos.';
  end if;

  -- Encerra convites pendentes da igreja antes de retirar as participações futuras.
  with affected_swaps as (
    select sr.id, sr.assignment_id, sr.previous_assignment_status
    from public.swap_requests sr
    join public.schedule_assignments sa on sa.id = sr.assignment_id
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.departments d on d.id = ds.department_id
    where sr.status = 'pending'
      and d.church_id = target_church_id
      and (sr.requested_by = target_user_id or sr.suggested_user_id = target_user_id or sa.user_id = target_user_id)
    for update of sr, sa
  ), restored as (
    update public.schedule_assignments sa
    set status = swaps.previous_assignment_status,
        responded_at = case when swaps.previous_assignment_status = 'confirmed' then now() else null end,
        updated_at = now()
    from affected_swaps swaps
    where sa.id = swaps.assignment_id and sa.status = 'replacement_requested'
    returning sa.id
  )
  update public.swap_requests sr
  set status = 'cancelled', updated_at = now()
  where sr.id in (select id from affected_swaps);

  update public.schedule_assignments sa
  set status = 'replaced', responded_at = now(), updated_at = now()
  from public.department_schedules ds
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  where sa.department_schedule_id = ds.id
    and d.church_id = target_church_id
    and sa.user_id = target_user_id
    and sa.status in ('pending', 'confirmed', 'replacement_requested')
    and ds.status in ('draft', 'published')
    and s.ends_at >= now();
  get diagnostics removed_assignments = row_count;

  update public.department_memberships dm
  set status = 'suspended', updated_at = now()
  from public.departments d
  where dm.department_id = d.id
    and d.church_id = target_church_id
    and dm.user_id = target_user_id
    and dm.status = 'active';

  delete from public.member_positions mp
  using public.positions pos, public.departments d
  where mp.position_id = pos.id
    and pos.department_id = d.id
    and d.church_id = target_church_id
    and mp.user_id = target_user_id;

  update public.church_memberships
  set status = 'suspended', role = 'member', updated_at = now()
  where id = target_membership_id;

  removal_event_key := 'membership:' || target_membership_id || ':removed';
  insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
  values (
    target_user_id,
    target_church_id,
    'Acesso à igreja removido',
    case when removed_assignments > 0
      then 'Seu acesso foi removido e suas próximas participações foram canceladas.'
      else 'Seu acesso a esta igreja foi removido.'
    end,
    'member_removed',
    '/painel',
    removal_event_key
  )
  on conflict (user_id, event_key) do nothing;

  return removed_assignments;
end;
$$;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('schedule_published', 'schedule_added', 'schedule_updated', 'schedule_deleted', 'swap_invite', 'swap_accepted', 'swap_rejected', 'member_confirmed', 'swap_requested', 'member_removed')
);

drop policy if exists "calendar events insert own" on public.google_calendar_events;
drop policy if exists "calendar events update own" on public.google_calendar_events;
drop policy if exists "calendar events delete own" on public.google_calendar_events;

revoke all on function public.remove_church_member(uuid) from public;
grant execute on function public.remove_church_member(uuid) to authenticated;
