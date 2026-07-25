create or replace function public.update_department_schedule(
  target_schedule_id uuid,
  schedule_title text,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_location text,
  schedule_notes text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target_department_id uuid;
  target_service_id uuid;
begin
  select department_id, service_id into target_department_id, target_service_id
  from public.department_schedules where id = target_schedule_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para editar esta escala.';
  end if;
  if schedule_ends_at <= schedule_starts_at then raise exception 'O término deve ser posterior ao início.'; end if;
  update public.services set title = trim(schedule_title), starts_at = schedule_starts_at,
    ends_at = schedule_ends_at, location = nullif(trim(schedule_location), ''),
    notes = nullif(trim(schedule_notes), ''), updated_at = now()
  where id = target_service_id;
end;
$$;

create or replace function public.remove_schedule_assignment(target_assignment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_department_id uuid;
begin
  select ds.department_id into target_department_id
  from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.id = target_assignment_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para remover esta pessoa.';
  end if;
  delete from public.schedule_assignments where id = target_assignment_id;
end;
$$;

revoke all on function public.update_department_schedule(uuid, text, timestamptz, timestamptz, text, text) from public;
revoke all on function public.remove_schedule_assignment(uuid) from public;
grant execute on function public.update_department_schedule(uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.remove_schedule_assignment(uuid) to authenticated;
