-- SCH-002: permite acumular funcoes diferentes ao aceitar uma substituicao.
-- Mantem vinculos ativos, autorizacao e conflitos com outras escalas.

create or replace function public.get_sector_swap_candidates(target_schedule_id uuid, target_assignment_id uuid)
returns table (candidate_user_id uuid, candidate_name text, candidate_avatar_path text, candidate_roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  with requester_schedule as (
    select ds.department_id, sa.position_id, s.starts_at as event_start, s.ends_at as event_end
    from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.services s on s.id = ds.service_id
    where sa.id = target_assignment_id
      and sa.department_schedule_id = target_schedule_id
      and sa.user_id = (select auth.uid())
      and sa.status in ('pending', 'confirmed')
      and ds.status = 'published'
  )
  select dm.user_id, p.full_name, p.avatar_path,
    coalesce(array_agg(distinct pos.name) filter (where pos.name is not null), '{}'::text[])
  from requester_schedule rs
  join public.department_memberships dm on dm.department_id = rs.department_id and dm.status = 'active'
  join public.profiles p on p.id = dm.user_id
  left join public.member_positions mp on mp.user_id = dm.user_id
  left join public.positions pos on pos.id = mp.position_id and pos.department_id = rs.department_id and pos.active
  where dm.user_id <> (select auth.uid())
    -- Impede apenas duplicar a mesma funcao na escala.
    and not exists (
      select 1 from public.schedule_assignments existing
      where existing.department_schedule_id = target_schedule_id
        and existing.user_id = dm.user_id
        and existing.position_id = rs.position_id
    )
    -- tem outro compromisso publicado que colide com o horario deste culto
    and not exists (
      select 1
      from public.schedule_assignments other_sa
      join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
      join public.services other_s on other_s.id = other_ds.service_id
      where other_sa.user_id = dm.user_id
        and other_ds.id <> target_schedule_id
        and other_ds.status = 'published'
        and other_sa.status in ('pending', 'confirmed', 'replacement_requested')
        and other_s.starts_at < rs.event_end
        and other_s.ends_at > rs.event_start
    )
  group by dm.user_id, p.full_name, p.avatar_path
  order by p.full_name;
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
  target_position_id uuid;
  request_id uuid;
  current_status public.assignment_status;
  event_start timestamptz;
  event_end timestamptz;
begin
  if not public.is_active_assignment_owner(target_assignment_id) then
    raise exception 'Seu acesso a esta igreja ou equipe não está ativo.';
  end if;

  select ds.department_id, d.church_id, ds.id, sa.position_id, sa.status, s.starts_at, s.ends_at
  into target_department_id, target_church_id, target_schedule_id, target_position_id, current_status, event_start, event_end
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
      and position_id = target_position_id
  ) then
    raise exception 'A pessoa escolhida já está nesta função da escala.';
  end if;
  if exists (
    select 1
    from public.schedule_assignments other_sa
    join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
    join public.services other_s on other_s.id = other_ds.service_id
    where other_sa.user_id = target_suggested_user_id
      and other_ds.id <> target_schedule_id
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
  target_position_id uuid;
begin
  select sr.assignment_id, sr.requested_by, sr.suggested_user_id,
         sr.previous_assignment_status, ds.department_id, d.church_id, ds.id, sa.position_id
  into target_assignment_id, requester_id, recipient_id, prior_status,
       target_department_id, target_church_id, target_schedule_id, target_position_id
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
        and position_id = target_position_id
        and id <> target_assignment_id
    ) then
      raise exception 'Você já está nesta função da escala.';
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

