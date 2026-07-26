alter table public.schedule_assignments add column if not exists available_until timestamptz;

drop function if exists public.confirm_schedule_assignment(uuid);

create or replace function public.confirm_schedule_assignment(target_assignment_id uuid, target_available_until timestamptz default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_active_assignment_owner(target_assignment_id) then
    raise exception 'Seu acesso a esta igreja ou equipe não está ativo.';
  end if;

  update public.schedule_assignments sa
  set status = 'confirmed', responded_at = now(), updated_at = now(), available_until = target_available_until
  from public.department_schedules ds
  where sa.id = target_assignment_id
    and sa.department_schedule_id = ds.id
    and sa.user_id = (select auth.uid())
    and sa.status = 'pending'
    and ds.status = 'published';

  if not found then
    if exists (
      select 1
      from public.schedule_assignments
      where id = target_assignment_id
        and user_id = (select auth.uid())
        and status = 'confirmed'
    ) then
      update public.schedule_assignments
      set available_until = target_available_until, updated_at = now()
      where id = target_assignment_id and user_id = (select auth.uid());
      return;
    end if;
    raise exception 'Esta participação não está disponível para confirmação.';
  end if;
end;
$$;

revoke all on function public.confirm_schedule_assignment(uuid, timestamptz) from public;
grant execute on function public.confirm_schedule_assignment(uuid, timestamptz) to authenticated;

drop function if exists public.get_schedule_team(uuid);

create or replace function public.get_schedule_team(target_schedule_id uuid)
returns table (
  assignment_id uuid,
  user_id uuid,
  assignment_status public.assignment_status,
  position_name text,
  member_name text,
  available_until timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, pos.name, p.full_name, sa.available_until
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.departments d on d.id = ds.department_id
  join public.churches c on c.id = d.church_id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where sa.department_schedule_id = target_schedule_id
    and c.status = 'active'
    and (
      public.is_assigned_department_leader(ds.department_id)
      or public.is_church_admin(d.church_id)
      or (
        ds.status = 'published'
        and exists (
          select 1
          from public.schedule_assignments viewer_assignment
          join public.church_memberships viewer_membership
            on viewer_membership.church_id = d.church_id
           and viewer_membership.user_id = (select auth.uid())
           and viewer_membership.status = 'active'
          where viewer_assignment.department_schedule_id = ds.id
            and viewer_assignment.user_id = (select auth.uid())
            and viewer_assignment.status in ('pending', 'confirmed', 'replacement_requested')
        )
      )
    )
  order by pos.name, p.full_name;
$$;

grant execute on function public.get_schedule_team(uuid) to authenticated;

drop function if exists public.get_my_schedule_assignment(uuid);

create or replace function public.get_my_schedule_assignment(target_schedule_id uuid)
returns table (assignment_id uuid, assignment_status public.assignment_status, available_until timestamptz)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.status, sa.available_until
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.department_schedule_id = target_schedule_id
    and sa.user_id = (select auth.uid())
    and ds.status = 'published'
    and public.is_active_assignment_owner(sa.id)
  limit 1;
$$;

grant execute on function public.get_my_schedule_assignment(uuid) to authenticated;
