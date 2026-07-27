-- Permite ao lider de um setor selecionar varias escalas na tela "Escalas
-- do setor" e (a) excluir todas de uma vez, ou (b) replicar cada uma para o
-- mes seguinte (mesma posicao no mes: ex. 1o domingo -> 1o domingo do mes
-- seguinte), mantendo horario, titulo e equipe. A replicacao cria rascunhos
-- num lote (batch_id), reaproveitando a tela de revisao ja existente.
create or replace function public.delete_schedules_batch(target_schedule_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  dept_id uuid;
begin
  if target_schedule_ids is null or array_length(target_schedule_ids, 1) is null then
    raise exception 'Selecione pelo menos uma escala.';
  end if;
  foreach sid in array target_schedule_ids loop
    select department_id into dept_id from public.department_schedules where id = sid;
    if dept_id is null or not public.is_assigned_department_leader(dept_id) then
      raise exception 'Sem permissão para excluir uma ou mais escalas selecionadas.';
    end if;
  end loop;
  delete from public.department_schedules where id = any(target_schedule_ids);
end;
$$;

revoke all on function public.delete_schedules_batch(uuid[]) from public;
grant execute on function public.delete_schedules_batch(uuid[]) to authenticated;

create or replace function public.replicate_schedules_to_next_month(target_schedule_ids uuid[])
returns table (schedule_id uuid, service_date date, batch_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_batch_id uuid := gen_random_uuid();
  sid uuid;
  src record;
  brasilia_start timestamp;
  week_of_month int;
  weekday int;
  target_month_first date;
  first_month_weekday int;
  offset_days int;
  first_occurrence date;
  last_occurrence date;
  target_date date;
  duration interval;
  new_starts timestamptz;
  new_ends timestamptz;
  new_service_id uuid;
  new_schedule_id uuid;
  produced boolean := false;
begin
  if target_schedule_ids is null or array_length(target_schedule_ids, 1) is null then
    raise exception 'Selecione pelo menos uma escala.';
  end if;
  if array_length(target_schedule_ids, 1) > 60 then
    raise exception 'Selecione no máximo 60 escalas por vez.';
  end if;

  foreach sid in array target_schedule_ids loop
    select ds.department_id as department_id, s.title as title, s.starts_at as starts_at, s.ends_at as ends_at, s.location as location, s.notes as notes
      into src
      from public.department_schedules ds
      join public.services s on s.id = ds.service_id
      where ds.id = sid;

    if src.department_id is null or not public.is_assigned_department_leader(src.department_id) then
      raise exception 'Sem permissão para replicar uma ou mais escalas selecionadas.';
    end if;

    -- horario local (Brasilia) de origem, pra achar o mesmo dia da semana e
    -- a mesma "posicao" (1o, 2o, 3o... daquele dia da semana) no mes seguinte
    brasilia_start := src.starts_at at time zone 'America/Sao_Paulo';
    weekday := extract(dow from brasilia_start)::int;
    week_of_month := ceil(extract(day from brasilia_start) / 7.0)::int;
    duration := src.ends_at - src.starts_at;

    target_month_first := (date_trunc('month', brasilia_start) + interval '1 month')::date;
    first_month_weekday := extract(dow from target_month_first)::int;
    offset_days := (weekday - first_month_weekday + 7) % 7;
    first_occurrence := target_month_first + offset_days;
    last_occurrence := first_occurrence;
    while (last_occurrence + 7) < (target_month_first + interval '1 month')::date loop
      last_occurrence := last_occurrence + 7;
    end loop;
    -- se o mes seguinte nao tiver a n-esima ocorrencia (ex.: pediu a 5a
    -- sexta-feira e so existem 4), cai pra ultima ocorrencia daquele dia
    target_date := least(first_occurrence + (week_of_month - 1) * 7, last_occurrence);

    new_starts := (target_date::text || ' ' || to_char(brasilia_start, 'HH24:MI:SS') || '-03:00')::timestamptz;
    new_ends := new_starts + duration;

    insert into public.services (church_id, title, starts_at, ends_at, location, notes, created_by)
    select d.church_id, src.title, new_starts, new_ends, src.location, src.notes, (select auth.uid())
    from public.departments d where d.id = src.department_id
    returning id into new_service_id;

    insert into public.department_schedules (service_id, department_id, created_by, batch_id)
    values (new_service_id, src.department_id, (select auth.uid()), new_batch_id)
    returning id into new_schedule_id;

    insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
    select new_schedule_id, sa.position_id, sa.user_id, (select auth.uid())
    from public.schedule_assignments sa where sa.department_schedule_id = sid;

    produced := true;
    schedule_id := new_schedule_id;
    service_date := target_date;
    batch_id := new_batch_id;
    return next;
  end loop;

  if not produced then
    raise exception 'Nenhuma escala válida para replicar.';
  end if;
end;
$$;

revoke all on function public.replicate_schedules_to_next_month(uuid[]) from public;
grant execute on function public.replicate_schedules_to_next_month(uuid[]) to authenticated;
