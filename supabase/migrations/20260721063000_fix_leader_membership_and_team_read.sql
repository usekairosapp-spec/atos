create or replace function public.validate_department_membership_tenant()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare target_church_id uuid;
begin
  select church_id into target_church_id from public.departments where id = new.department_id;
  if target_church_id is null or not exists (select 1 from public.church_memberships where church_id = target_church_id and user_id = new.user_id and status = 'active') then
    raise exception 'A pessoa precisa ser membro ativo da mesma igreja.';
  end if;
  if new.role = 'leader'
    and not (tg_op = 'UPDATE' and old.role = 'leader' and old.department_id = new.department_id and old.user_id = new.user_id)
    and not public.is_church_admin(target_church_id) then
    raise exception 'Apenas a administradora da igreja pode designar líderes.';
  end if;
  return new;
end;
$$;

create or replace function public.get_schedule_team(target_schedule_id uuid)
returns table (assignment_id uuid, user_id uuid, assignment_status public.assignment_status, position_name text, member_name text)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, pos.name, p.full_name
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where sa.department_schedule_id = target_schedule_id
    and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin(d.church_id) or sa.user_id = (select auth.uid()))
  order by pos.name, p.full_name;
$$;

revoke all on function public.get_schedule_team(uuid) from public;
grant execute on function public.get_schedule_team(uuid) to authenticated;
