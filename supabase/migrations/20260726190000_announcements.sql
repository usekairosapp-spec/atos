create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  department_id uuid references public.departments(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 150),
  body text not null check (char_length(body) between 2 and 2000),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index announcements_church_idx on public.announcements(church_id, created_at desc);
create index announcements_department_idx on public.announcements(department_id);
create index announcements_target_user_idx on public.announcements(target_user_id);

alter table public.announcements enable row level security;

create policy "announcements visible to recipients" on public.announcements
for select to authenticated using (
  target_user_id = (select auth.uid())
  or created_by = (select auth.uid())
  or public.is_church_admin(church_id)
  or (department_id is not null and exists (
    select 1 from public.department_memberships dm
    where dm.department_id = announcements.department_id
      and dm.user_id = (select auth.uid())
      and dm.status = 'active'
  ))
  or (department_id is null and target_user_id is null and public.is_active_church_member(church_id))
);

-- Amplia os tipos de notificacao existentes para incluir comunicados
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('schedule_published', 'schedule_added', 'schedule_updated', 'schedule_deleted', 'swap_invite', 'swap_accepted', 'swap_rejected', 'member_confirmed', 'swap_requested', 'member_removed', 'membership_requested', 'membership_approved', 'membership_rejected', 'announcement')
);

-- Publica um comunicado para toda a igreja, um setor especifico ou uma unica pessoa.
-- Lideres de setor (inclusive quando tambem sao admin da igreja) podem publicar
-- para os setores que lideram ou para membros desses setores; apenas a
-- administradora da igreja pode publicar para a igreja inteira.
create or replace function public.create_announcement(
  target_church_id uuid,
  target_department_id uuid,
  target_user_id_param uuid,
  announcement_title text,
  announcement_body text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  is_admin boolean := public.is_church_admin(target_church_id);
  new_id uuid;
begin
  if target_user_id_param is not null then
    if not (is_admin or exists (
      select 1 from public.department_memberships dm
      join public.department_memberships leader_dm
        on leader_dm.department_id = dm.department_id
        and leader_dm.user_id = actor_id
        and leader_dm.role = 'leader'
        and leader_dm.status = 'active'
      where dm.user_id = target_user_id_param and dm.status = 'active'
    )) then
      raise exception 'Sem permissão para enviar comunicado a esta pessoa.';
    end if;
  elsif target_department_id is not null then
    if not (is_admin or public.is_department_leader(target_department_id)) then
      raise exception 'Sem permissão para publicar neste setor.';
    end if;
  else
    if not is_admin then
      raise exception 'Apenas a administradora da igreja pode publicar para toda a igreja.';
    end if;
  end if;

  insert into public.announcements (church_id, department_id, target_user_id, title, body, created_by)
  values (target_church_id, target_department_id, target_user_id_param, announcement_title, announcement_body, actor_id)
  returning id into new_id;

  if target_user_id_param is not null then
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    values (target_user_id_param, target_church_id, announcement_title, announcement_body, 'announcement', '/painel/comunicados/' || new_id);
  elsif target_department_id is not null then
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    select dm.user_id, target_church_id, announcement_title, announcement_body, 'announcement', '/painel/comunicados/' || new_id
    from public.department_memberships dm
    where dm.department_id = target_department_id and dm.status = 'active' and dm.user_id <> actor_id;
  else
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    select cm.user_id, target_church_id, announcement_title, announcement_body, 'announcement', '/painel/comunicados/' || new_id
    from public.church_memberships cm
    where cm.church_id = target_church_id and cm.status = 'active' and cm.user_id <> actor_id;
  end if;

  return new_id;
end;
$$;

revoke all on function public.create_announcement(uuid, uuid, uuid, text, text) from public;
grant execute on function public.create_announcement(uuid, uuid, uuid, text, text) to authenticated;
