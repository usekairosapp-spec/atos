create or replace function public.delete_department_schedule(target_schedule_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_service_id uuid; target_church_id uuid;
begin
  select ds.service_id, d.church_id into target_service_id, target_church_id
  from public.department_schedules ds join public.departments d on d.id = ds.department_id
  where ds.id = target_schedule_id;
  if target_service_id is null or not public.is_church_admin(target_church_id) then
    raise exception 'Apenas a administradora da igreja pode excluir esta escala.';
  end if;
  delete from public.services where id = target_service_id;
end;
$$;

revoke all on function public.delete_department_schedule(uuid) from public;
grant execute on function public.delete_department_schedule(uuid) to authenticated;
