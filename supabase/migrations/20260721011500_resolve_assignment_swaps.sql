create or replace function public.resolve_assignment_swap(
  target_request_id uuid,
  replacement_user_id uuid,
  accept_request boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  target_assignment_id uuid;
  target_department_id uuid;
begin
  select sr.assignment_id, ds.department_id
  into target_assignment_id, target_department_id
  from public.swap_requests sr
  join public.schedule_assignments sa on sa.id = sr.assignment_id
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sr.id = target_request_id and sr.status = 'pending';

  if target_assignment_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Pedido não encontrado ou sem permissão.';
  end if;

  if not accept_request then
    update public.swap_requests set status = 'rejected', updated_at = now() where id = target_request_id;
    update public.schedule_assignments set status = 'pending', responded_at = null, updated_at = now() where id = target_assignment_id;
    return;
  end if;

  if replacement_user_id is null or not exists (
    select 1 from public.department_memberships
    where department_id = target_department_id and user_id = replacement_user_id and status = 'active'
  ) then raise exception 'Escolha um membro ativo do setor.'; end if;

  update public.schedule_assignments
  set user_id = replacement_user_id, status = 'pending', responded_at = null, updated_at = now()
  where id = target_assignment_id;
  update public.swap_requests set status = 'accepted', suggested_user_id = replacement_user_id, updated_at = now()
  where id = target_request_id;
end;
$$;

revoke all on function public.resolve_assignment_swap(uuid, uuid, boolean) from public;
grant execute on function public.resolve_assignment_swap(uuid, uuid, boolean) to authenticated;
