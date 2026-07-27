-- A validacao "end_time <= start_time" rejeitava cultos que passam da
-- meia-noite (ex.: vigilia 23h as 01h), algo que a criacao de uma unica
-- escala ja permite (ela compara os timestamps completos, nao so o horario).
-- Agora, se o horario final for menor ou igual ao inicial, assume-se que o
-- culto termina no dia seguinte, em vez de rejeitar de cara.
create or replace function public.create_department_schedules_batch(
  target_department_id uuid,
  target_dates date[],
  schedule_title text,
  start_time time,
  end_time time,
  schedule_location text,
  schedule_notes text,
  target_assignments jsonb
)
returns table (schedule_id uuid, service_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_church_id uuid;
  d date;
  new_service_id uuid;
  new_schedule_id uuid;
  item jsonb;
  starts_at_ts timestamptz;
  ends_at_ts timestamptz;
begin
  if not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder atribuído pode criar escalas para este setor.';
  end if;
  if target_dates is null or array_length(target_dates, 1) is null then
    raise exception 'Selecione pelo menos um dia no calendário.';
  end if;
  if jsonb_typeof(target_assignments) <> 'array' or jsonb_array_length(target_assignments) = 0 then
    raise exception 'Selecione pelo menos uma pessoa para a equipe.';
  end if;

  select church_id into target_church_id from public.departments where id = target_department_id and active;
  if target_church_id is null then
    raise exception 'Setor não encontrado.';
  end if;

  -- valida cada selecao de equipe uma unica vez, antes de criar qualquer escala
  for item in select * from jsonb_array_elements(target_assignments) loop
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

  foreach d in array target_dates loop
    -- interpreta data + horario no fuso de Brasilia, igual a criacao manual de uma escala
    starts_at_ts := (d::text || ' ' || start_time::text || '-03:00')::timestamptz;
    ends_at_ts := (d::text || ' ' || end_time::text || '-03:00')::timestamptz;
    -- culto que passa da meia-noite: se o horario final "parece" antes do
    -- inicial no mesmo dia, entende-se que termina no dia seguinte
    if ends_at_ts <= starts_at_ts then
      ends_at_ts := ends_at_ts + interval '1 day';
    end if;

    insert into public.services (church_id, title, starts_at, ends_at, location, notes, created_by)
    values (
      target_church_id,
      trim(schedule_title),
      starts_at_ts,
      ends_at_ts,
      nullif(trim(schedule_location), ''),
      nullif(trim(schedule_notes), ''),
      (select auth.uid())
    )
    returning id into new_service_id;

    insert into public.department_schedules (service_id, department_id, created_by)
    values (new_service_id, target_department_id, (select auth.uid()))
    returning id into new_schedule_id;

    for item in select * from jsonb_array_elements(target_assignments) loop
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
end;
$$;
