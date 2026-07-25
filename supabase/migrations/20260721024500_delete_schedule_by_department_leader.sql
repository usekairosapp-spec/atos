create or replace function public.delete_department_schedule(target_schedule_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_service_id uuid; target_department_id uuid;
begin
  select service_id, department_id into target_service_id, target_department_id
  from public.department_schedules where id = target_schedule_id;
  if target_service_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder responsável pelo setor pode excluir esta escala.';
  end if;
  delete from public.services where id = target_service_id;
end;
$$;
