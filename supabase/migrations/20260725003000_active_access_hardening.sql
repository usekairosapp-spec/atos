-- Toda leitura ou alteração pessoal de escala exige igreja, vínculo e setor ativos.

create or replace function public.is_active_assignment_owner(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.departments d on d.id = ds.department_id
    join public.churches c on c.id = d.church_id
    join public.church_memberships cm
      on cm.church_id = d.church_id
     and cm.user_id = sa.user_id
     and cm.status = 'active'
    join public.department_memberships dm
      on dm.department_id = d.id
     and dm.user_id = sa.user_id
     and dm.status = 'active'
    where sa.id = target_assignment_id
      and sa.user_id = (select auth.uid())
      and c.status = 'active'
      and d.active
  );
$$;

revoke all on function public.is_active_assignment_owner(uuid) from public;
grant execute on function public.is_active_assignment_owner(uuid) to authenticated;

create or replace function public.confirm_schedule_assignment(target_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_assignment_owner(target_assignment_id) then
    raise exception 'Seu acesso a esta igreja ou equipe não está ativo.';
  end if;

  update public.schedule_assignments sa
  set status = 'confirmed', responded_at = now(), updated_at = now()
  from public.department_schedules ds
  where sa.id = target_assignment_id
    and sa.department_schedule_id = ds.id
    and sa.user_id = (select auth.uid())
    and sa.status = 'pending'
    and ds.status = 'published';

  if not found then
    if exists (
      select 1
      from public.schedule_assignments
      where id = target_assignment_id
        and user_id = (select auth.uid())
        and status = 'confirmed'
    ) then
      return;
    end if;
    raise exception 'Esta participação não está disponível para confirmação.';
  end if;
end;
$$;

create or replace function public.request_assignment_swap(
  target_assignment_id uuid,
  target_suggested_user_id uuid default null,
  swap_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_id uuid := (select auth.uid());
  target_department_id uuid;
  target_church_id uuid;
  target_schedule_id uuid;
  request_id uuid;
  current_status public.assignment_status;
  event_start timestamptz;
  event_end timestamptz;
begin
  if not public.is_active_assignment_owner(target_assignment_id) then
    raise exception 'Seu acesso a esta igreja ou equipe não está ativo.';
  end if;

  select ds.department_id, d.church_id, ds.id, sa.status, s.starts_at, s.ends_at
  into target_department_id, target_church_id, target_schedule_id, current_status, event_start, event_end
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.services s on s.id = ds.service_id
  where sa.id = target_assignment_id
    and sa.user_id = requester_id
    and sa.status in ('pending', 'confirmed')
    and ds.status = 'published'
  for update of sa;

  if target_department_id is null then
    raise exception 'Escala não encontrada ou indisponível para troca.';
  end if;
  if target_suggested_user_id is null or target_suggested_user_id = requester_id then
    raise exception 'Selecione outra pessoa para a troca.';
  end if;
  if not exists (
    select 1
    from public.department_memberships dm
    join public.church_memberships cm
      on cm.user_id = dm.user_id
     and cm.church_id = target_church_id
     and cm.status = 'active'
    join public.churches c on c.id = cm.church_id and c.status = 'active'
    where dm.department_id = target_department_id
      and dm.user_id = target_suggested_user_id
      and dm.status = 'active'
  ) then
    raise exception 'A pessoa escolhida não está ativa neste setor.';
  end if;
  if exists (
    select 1 from public.schedule_assignments
    where department_schedule_id = target_schedule_id
      and user_id = target_suggested_user_id
  ) then
    raise exception 'A pessoa escolhida já está nesta escala.';
  end if;
  if exists (
    select 1
    from public.schedule_assignments other_sa
    join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
    join public.services other_s on other_s.id = other_ds.service_id
    where other_sa.user_id = target_suggested_user_id
      and other_ds.status = 'published'
      and other_sa.status in ('pending', 'confirmed', 'replacement_requested')
      and other_s.starts_at < event_end
      and other_s.ends_at > event_start
  ) then
    raise exception 'A pessoa escolhida já possui outra escala neste horário.';
  end if;

  insert into public.swap_requests (
    assignment_id, requested_by, suggested_user_id, reason, previous_assignment_status
  )
  values (
    target_assignment_id, requester_id, target_suggested_user_id,
    nullif(trim(swap_reason), ''), current_status
  )
  returning id into request_id;

  update public.schedule_assignments
  set status = 'replacement_requested', responded_at = now(), updated_at = now()
  where id = target_assignment_id and status = current_status;

  return request_id;
end;
$$;

create or replace function public.respond_to_peer_swap(
  target_request_id uuid,
  accept_request boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment_id uuid;
  requester_id uuid;
  recipient_id uuid;
  prior_status public.assignment_status;
  target_department_id uuid;
  target_church_id uuid;
  target_schedule_id uuid;
begin
  select sr.assignment_id, sr.requested_by, sr.suggested_user_id,
         sr.previous_assignment_status, ds.department_id, d.church_id, ds.id
  into target_assignment_id, requester_id, recipient_id, prior_status,
       target_department_id, target_church_id, target_schedule_id
  from public.swap_requests sr
  join public.schedule_assignments sa on sa.id = sr.assignment_id
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.churches c on c.id = d.church_id and c.status = 'active'
  where sr.id = target_request_id
    and sr.status = 'pending'
    and ds.status = 'published'
    and d.active
  for update of sr, sa;

  if target_assignment_id is null or recipient_id <> (select auth.uid()) then
    raise exception 'Convite de troca não encontrado ou sem permissão.';
  end if;
  if not exists (
    select 1
    from public.church_memberships cm
    join public.department_memberships dm
      on dm.user_id = cm.user_id
     and dm.department_id = target_department_id
     and dm.status = 'active'
    where cm.church_id = target_church_id
      and cm.user_id = recipient_id
      and cm.status = 'active'
  ) then
    raise exception 'Você não está mais ativo nesta igreja ou equipe.';
  end if;
  if not exists (
    select 1 from public.church_memberships
    where church_id = target_church_id
      and user_id = requester_id
      and status = 'active'
  ) then
    raise exception 'A pessoa que solicitou a troca não está mais ativa na igreja.';
  end if;

  if accept_request then
    if exists (
      select 1 from public.schedule_assignments
      where department_schedule_id = target_schedule_id
        and user_id = recipient_id
        and id <> target_assignment_id
    ) then
      raise exception 'Você já está nesta escala.';
    end if;
    update public.schedule_assignments
    set user_id = recipient_id, status = 'confirmed',
        responded_at = now(), updated_at = now()
    where id = target_assignment_id and status = 'replacement_requested';
    if not found then
      raise exception 'A participação mudou enquanto a troca era processada.';
    end if;
    update public.swap_requests
    set status = 'accepted', updated_at = now()
    where id = target_request_id and status = 'pending';
  else
    update public.schedule_assignments
    set status = prior_status,
        responded_at = case when prior_status = 'confirmed' then now() else null end,
        updated_at = now()
    where id = target_assignment_id and status = 'replacement_requested';
    if not found then
      raise exception 'A participação mudou enquanto a troca era processada.';
    end if;
    update public.swap_requests
    set status = 'rejected', updated_at = now()
    where id = target_request_id and status = 'pending';
  end if;
end;
$$;

create or replace function public.can_view_department_schedule(target_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    join public.churches c on c.id = d.church_id
    where ds.id = target_schedule_id
      and c.status = 'active'
      and d.active
      and (
        public.is_church_admin(d.church_id)
        or public.is_assigned_department_leader(ds.department_id)
        or (
          ds.status = 'published'
          and exists (
            select 1
            from public.church_memberships cm
            where cm.church_id = d.church_id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
          and (
            exists (
              select 1
              from public.schedule_assignments sa
              join public.department_memberships dm
                on dm.department_id = d.id
               and dm.user_id = sa.user_id
               and dm.status = 'active'
              where sa.department_schedule_id = ds.id
                and sa.user_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.swap_requests sr
              join public.schedule_assignments sa on sa.id = sr.assignment_id
              join public.department_memberships dm
                on dm.department_id = d.id
               and dm.user_id = sr.suggested_user_id
               and dm.status = 'active'
              where sa.department_schedule_id = ds.id
                and sr.suggested_user_id = (select auth.uid())
                and sr.status = 'pending'
            )
          )
        )
      )
  );
$$;

drop policy if exists "assignments read by authorized users"
  on public.schedule_assignments;
create policy "assignments read by authorized users"
on public.schedule_assignments
for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and public.is_active_assignment_owner(id)
  )
  or exists (
    select 1
    from public.swap_requests sr
    join public.department_schedules ds on ds.id = department_schedule_id
    join public.departments d on d.id = ds.department_id
    join public.church_memberships cm
      on cm.church_id = d.church_id
     and cm.user_id = (select auth.uid())
     and cm.status = 'active'
    join public.department_memberships dm
      on dm.department_id = d.id
     and dm.user_id = (select auth.uid())
     and dm.status = 'active'
    join public.churches c on c.id = d.church_id and c.status = 'active'
    where sr.assignment_id = schedule_assignments.id
      and sr.suggested_user_id = (select auth.uid())
      and sr.status = 'pending'
  )
  or exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    where ds.id = schedule_assignments.department_schedule_id
      and (
        public.is_assigned_department_leader(ds.department_id)
        or public.is_church_admin(d.church_id)
      )
  )
);

create or replace function public.get_my_schedule_assignment(target_schedule_id uuid)
returns table (assignment_id uuid, assignment_status public.assignment_status)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.status
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  limit 1;
$$;

create or replace function public.get_my_schedule_assignments(target_church_id uuid)
returns table (
  department_schedule_id uuid,
  user_id uuid,
  assignment_status public.assignment_status,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select sa.department_schedule_id, sa.user_id, sa.status, p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.user_id = (select auth.uid())
    and d.church_id = target_church_id
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  order by sa.created_at;
$$;

create or replace function public.get_my_swap_page_data(
  target_schedule_id uuid,
  target_assignment_id uuid
)
returns table (
  assignment_id uuid,
  assignment_status public.assignment_status,
  department_id uuid,
  department_name text,
  position_name text,
  service_title text,
  service_starts_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.status, ds.department_id, d.name, p.name, s.title, s.starts_at
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  join public.services s on s.id = ds.service_id
  where sa.id = target_assignment_id
    and sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and sa.status in ('pending', 'confirmed')
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  limit 1;
$$;

create or replace function public.get_my_confirmation_page_data(
  target_schedule_id uuid,
  target_assignment_id uuid
)
returns table (
  assignment_id uuid,
  service_title text,
  service_starts_at timestamptz,
  department_name text,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, s.title, s.starts_at, d.name, p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.id = target_assignment_id
    and sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and sa.status = 'confirmed'
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  limit 1;
$$;

create or replace function public.get_my_calendar_event_data(target_assignment_id uuid)
returns table (
  assignment_id uuid,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  service_notes text,
  department_name text,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, ds.id, s.title, s.starts_at, s.ends_at, s.location, s.notes, d.name, p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.id = target_assignment_id
    and sa.user_id = (select auth.uid())
    and sa.status = 'confirmed'
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  limit 1;
$$;

create or replace function public.get_personal_calendar_assignments(target_church_id uuid)
returns table (
  assignment_id uuid,
  owner_user_id uuid,
  assignment_status public.assignment_status,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  department_name text,
  position_name text
)
language sql stable security definer set search_path = ''
as $$
  select distinct sa.id, sa.user_id, sa.status, ds.id, s.title, s.starts_at,
                  s.ends_at, s.location, d.name, p.name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  where sa.user_id = (select auth.uid())
    and d.church_id = target_church_id
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  order by s.starts_at, d.name, p.name;
$$;

create or replace function public.get_personal_calendar_month(
  target_church_id uuid,
  target_month date
)
returns table (
  assignment_id uuid,
  owner_user_id uuid,
  assignment_status public.assignment_status,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  department_name text,
  position_name text,
  google_html_link text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, ds.id, s.title, s.starts_at, s.ends_at,
         s.location, d.name, p.name, gce.html_link
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  left join public.google_calendar_events gce
    on gce.assignment_id = sa.id and gce.user_id = sa.user_id
  where sa.user_id = (select auth.uid())
    and sa.status in ('pending', 'confirmed', 'replacement_requested')
    and d.church_id = target_church_id
    and ds.status = 'published'
    and s.ends_at >= now()
    and public.is_active_assignment_owner(sa.id)
    and s.starts_at >= (
      date_trunc('month', target_month::timestamp)
      at time zone 'America/Sao_Paulo'
    )
    and s.starts_at < (
      (date_trunc('month', target_month::timestamp) + interval '1 month')
      at time zone 'America/Sao_Paulo'
    )
  order by s.starts_at, d.name, p.name;
$$;

create or replace function public.claim_my_google_calendar_sync(target_assignment_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  claimant uuid := (select auth.uid());
  token uuid := gen_random_uuid();
  claimed uuid;
begin
  if not public.is_active_assignment_owner(target_assignment_id)
    or not exists (
      select 1
      from public.schedule_assignments sa
      join public.department_schedules ds on ds.id = sa.department_schedule_id
      where sa.id = target_assignment_id
        and sa.user_id = claimant
        and sa.status = 'confirmed'
        and ds.status = 'published'
    ) then
    raise exception 'Escala confirmada não encontrada ou acesso inativo.';
  end if;

  insert into public.google_calendar_sync_locks (
    assignment_id, user_id, lock_token, locked_until
  )
  values (target_assignment_id, claimant, token, now() + interval '2 minutes')
  on conflict (assignment_id) do update
    set user_id = excluded.user_id,
        lock_token = excluded.lock_token,
        locked_until = excluded.locked_until,
        updated_at = now()
    where public.google_calendar_sync_locks.locked_until < now()
       or public.google_calendar_sync_locks.user_id <> claimant
  returning lock_token into claimed;

  return claimed;
end;
$$;

create or replace function public.save_my_google_calendar_event(
  target_assignment_id uuid,
  target_google_event_id text,
  target_html_link text,
  target_lock_token uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_active_assignment_owner(target_assignment_id)
    or not exists (
      select 1
      from public.schedule_assignments sa
      join public.department_schedules ds on ds.id = sa.department_schedule_id
      join public.google_calendar_sync_locks l on l.assignment_id = sa.id
      where sa.id = target_assignment_id
        and sa.user_id = (select auth.uid())
        and sa.status = 'confirmed'
        and ds.status = 'published'
        and l.user_id = (select auth.uid())
        and l.lock_token = target_lock_token
        and l.locked_until >= now()
    ) then
    raise exception 'Sincronização expirada, removida ou sem permissão.';
  end if;
  if nullif(trim(target_google_event_id), '') is null then
    raise exception 'Evento Google inválido.';
  end if;

  insert into public.google_calendar_events (
    user_id, assignment_id, google_event_id, html_link
  )
  values (
    (select auth.uid()), target_assignment_id,
    trim(target_google_event_id), nullif(trim(target_html_link), '')
  )
  on conflict (user_id, assignment_id) do update
  set google_event_id = excluded.google_event_id,
      html_link = excluded.html_link,
      updated_at = now();
end;
$$;

revoke all on function public.confirm_schedule_assignment(uuid) from public;
revoke all on function public.request_assignment_swap(uuid, uuid, text) from public;
revoke all on function public.respond_to_peer_swap(uuid, boolean) from public;
grant execute on function public.confirm_schedule_assignment(uuid) to authenticated;
grant execute on function public.request_assignment_swap(uuid, uuid, text) to authenticated;
grant execute on function public.respond_to_peer_swap(uuid, boolean) to authenticated;
