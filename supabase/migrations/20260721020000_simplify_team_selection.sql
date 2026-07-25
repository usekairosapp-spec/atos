create or replace function public.add_schedule_assignment(
  target_schedule_id uuid,
  target_position_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare target_department_id uuid; target_church_id uuid; new_assignment_id uuid;
begin
  select ds.department_id, d.church_id into target_department_id, target_church_id
  from public.department_schedules ds join public.departments d on d.id = ds.department_id
  where ds.id = target_schedule_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para alterar esta escala.';
  end if;
  if not exists (select 1 from public.positions where id = target_position_id and department_id = target_department_id and active) then
    raise exception 'Função inválida para este setor.';
  end if;
  if not exists (select 1 from public.church_memberships where church_id = target_church_id and user_id = target_user_id and status = 'active') then
    raise exception 'A pessoa precisa ser membro aprovado da igreja.';
  end if;
  insert into public.department_memberships (department_id, user_id, role, status)
  values (target_department_id, target_user_id, 'member', 'active')
  on conflict (department_id, user_id) do update set status = 'active';
  insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
  values (target_schedule_id, target_position_id, target_user_id, (select auth.uid()))
  returning id into new_assignment_id;
  return new_assignment_id;
end;
$$;
