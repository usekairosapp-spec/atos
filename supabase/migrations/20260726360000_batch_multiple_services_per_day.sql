-- Permite mais de um culto no mesmo dia na criacao em lote (ex.: culto da
-- manha e culto da noite), cada um com seu proprio horario, titulo e equipe.
-- Troca os parametros de um unico culto (title/start/end/location/notes/
-- assignments) por um array "target_services", onde cada elemento e um
-- culto completo com sua propria equipe. Para cada data marcada, cria-se
-- uma escala por culto informado.
drop function if exists public.create_department_schedules_batch(uuid, date[], text, time, time, text, text, jsonb);

create or replace function public.create_department_schedules_batch(
  target_department_id uuid,
  target_dates date[],
  target_services jsonb
)
returns table (schedule_id uuid, service_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id uuid;
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

      insert into public.department_schedules (service_id, department_id, created_by)
      values (new_service_id, target_department_id, (select auth.uid()))
      returning id into new_schedule_id;

      for item in select * from jsonb_array_elements(svc_assignments) loop
        insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
        values (new_schedule_id, (item->>'positionId')::uuid, (item->>'userId')::uuid, (select auth.uid()));
      end loop;

      update public.department_schedules
      set status = 'published', published_at = now(), updated_at = now()
      where id = new_schedule_id;

      schedule_id := new_schedule_id;
      service_date := d;
      return next;
    end loop;
  end loop;
end;
$$;

revoke all on function public.create_department_schedules_batch(uuid, date[], jsonb) from public;
grant execute on function public.create_department_schedules_batch(uuid, date[], jsonb) to authenticated;
