-- Adiciona uma etapa de revisao antes de publicar uma escala em lote: em vez
-- de criar e publicar tudo de uma vez, o lote agora cria as escalas como
-- rascunho, marcadas com um "batch_id" em comum. Uma tela de revisao lista
-- todos os dias do lote, permitindo ajustar a equipe de um dia especifico
-- (reaproveitando a tela normal de escala, que ja edita rascunhos) antes de
-- publicar tudo de uma vez, uma a uma (pra manter as notificacoes
-- individuais, igual a criacao avulsa).
alter table public.department_schedules add column if not exists batch_id uuid;
create index if not exists department_schedules_batch_id_idx on public.department_schedules (batch_id) where batch_id is not null;

drop function if exists public.create_department_schedules_batch(uuid, date[], jsonb);

create or replace function public.create_department_schedules_batch(
  target_department_id uuid,
  target_dates date[],
  target_services jsonb
)
returns table (schedule_id uuid, service_date date, batch_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id uuid;
  new_batch_id uuid := gen_random_uuid();
  d date;
  svc jsonb;
  item jsonb;
  new_service_id uuid;
  new_schedule_id uuid;
  starts_at_ts timestamptz;
  ends_at_ts timestamptz;
  svc_start time;
  svc_end time;
  svc_assignments jsonb;
begin
  if not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder atribuído pode criar escalas para este setor.';
  end if;
  if target_dates is null or array_length(target_dates, 1) is null then
    raise exception 'Selecione pelo menos um dia no calendário.';
  end if;
  if array_length(target_dates, 1) > 60 then
    raise exception 'Selecione no máximo 60 dias por vez.';
  end if;
  if jsonb_typeof(target_services) <> 'array' or jsonb_array_length(target_services) = 0 then
    raise exception 'Informe pelo menos um culto.';
  end if;
  if jsonb_array_length(target_services) > 5 then
    raise exception 'Informe no máximo 5 cultos por dia.';
  end if;

  select church_id into target_church_id from public.departments where id = target_department_id and active;
  if target_church_id is null then
    raise exception 'Setor não encontrado.';
  end if;

  -- valida cada culto e sua equipe uma unica vez, antes de criar qualquer escala
  for svc in select * from jsonb_array_elements(target_services) loop
    svc_assignments := svc->'assignments';
    if jsonb_typeof(svc_assignments) <> 'array' or jsonb_array_length(svc_assignments) = 0 then
      raise exception 'Cada culto precisa de pelo menos uma pessoa na equipe.';
    end if;
    for item in select * from jsonb_array_elements(svc_assignments) loop
      if not exists (
        select 1 from public.positions
        where id = (item->>'positionId')::uuid and department_id = target_department_id and active
      ) then
        raise exception 'Função inválida para este setor.';
      end if;
      if not exists (
        select 1 from public.department_memberships
        where department_id = target_department_id and user_id = (item->>'userId')::uuid and status = 'active'
      ) then
        raise exception 'A pessoa precisa ser membro ativo do setor.';
      end if;
    end loop;
  end loop;

  foreach d in array target_dates loop
    for svc in select * from jsonb_array_elements(target_services) loop
      svc_start := (svc->>'startTime')::time;
      svc_end := (svc->>'endTime')::time;
      svc_assignments := svc->'assignments';

      -- interpreta data + horario no fuso de Brasilia, igual a criacao manual de uma escala
      starts_at_ts := (d::text || ' ' || svc_start::text || '-03:00')::timestamptz;
      ends_at_ts := (d::text || ' ' || svc_end::text || '-03:00')::timestamptz;
      -- culto que passa da meia-noite: se o horario final "parece" antes do
      -- inicial no mesmo dia, entende-se que termina no dia seguinte
      if ends_at_ts <= starts_at_ts then
        ends_at_ts := ends_at_ts + interval '1 day';
      end if;

      insert into public.services (church_id, title, starts_at, ends_at, location, notes, created_by)
      values (
        target_church_id,
        trim(svc->>'title'),
        starts_at_ts,
        ends_at_ts,
        nullif(trim(coalesce(svc->>'location', '')), ''),
        nullif(trim(coalesce(svc->>'notes', '')), ''),
        (select auth.uid())
      )
      returning id into new_service_id;

      insert into public.department_schedules (service_id, department_id, created_by, batch_id)
      values (new_service_id, target_department_id, (select auth.uid()), new_batch_id)
      returning id into new_schedule_id;

      for item in select * from jsonb_array_elements(svc_assignments) loop
        insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
        values (new_schedule_id, (item->>'positionId')::uuid, (item->>'userId')::uuid, (select auth.uid()));
      end loop;

      schedule_id := new_schedule_id;
      service_date := d;
      batch_id := new_batch_id;
      return next;
    end loop;
  end loop;
end;
$$;

revoke all on function public.create_department_schedules_batch(uuid, date[], jsonb) from public;
grant execute on function public.create_department_schedules_batch(uuid, date[], jsonb) to authenticated;

-- Publica de uma vez todos os rascunhos de um lote, um por um (preserva a
-- notificacao individual de cada escala publicada).
create or replace function public.publish_schedule_batch(target_batch_id uuid)
returns table (schedule_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  draft record;
begin
  for draft in
    select ds.id, ds.department_id from public.department_schedules ds where ds.batch_id = target_batch_id and ds.status = 'draft'
  loop
    if not public.is_assigned_department_leader(draft.department_id) then
      raise exception 'Apenas o líder atribuído pode publicar escalas deste setor.';
    end if;
    if not exists (select 1 from public.schedule_assignments where department_schedule_id = draft.id) then
      raise exception 'Todo dia do lote precisa de pelo menos uma pessoa na equipe antes de publicar.';
    end if;
    update public.department_schedules set status = 'published', published_at = now(), updated_at = now() where id = draft.id;
    schedule_id := draft.id;
    return next;
  end loop;
  if schedule_id is null then
    raise exception 'Nenhuma escala pendente encontrada para publicar neste lote.';
  end if;
end;
$$;

revoke all on function public.publish_schedule_batch(uuid) from public;
grant execute on function public.publish_schedule_batch(uuid) to authenticated;

-- Lista a equipe de todas as escalas de um lote de uma vez, pra tela de
-- revisao nao precisar de uma chamada por dia.
create or replace function public.get_batch_team(target_batch_id uuid)
returns table (schedule_id uuid, assignment_id uuid, position_name text, member_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select ds.id, sa.id, pos.name, p.full_name
  from public.department_schedules ds
  join public.departments d on d.id = ds.department_id
  join public.schedule_assignments sa on sa.department_schedule_id = ds.id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where ds.batch_id = target_batch_id
    and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin(d.church_id))
  order by ds.id, pos.name, p.full_name;
$$;

revoke all on function public.get_batch_team(uuid) from public;
grant execute on function public.get_batch_team(uuid) to authenticated;
