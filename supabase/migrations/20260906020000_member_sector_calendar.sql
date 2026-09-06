-- STAB-001: consulta de equipes publicadas dos setores do membro.
create or replace function public.get_department_calendar_month(
  target_church_id uuid,
  target_month date
)
returns table (
  assignment_id uuid,
  owner_user_id uuid,
  assignment_status public.assignment_status,
  schedule_id uuid,
  service_title text,
  service_starts_at timestamptz,
  service_ends_at timestamptz,
  service_location text,
  department_name text,
  position_name text,
  google_html_link text
)
language sql stable security definer set search_path = ''
as $$
  select sa.id, sa.user_id, sa.status, ds.id, s.title, s.starts_at, s.ends_at,
         s.location, d.name, p.name, case when sa.user_id = (select auth.uid()) then gce.html_link else null end
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions p on p.id = sa.position_id
  left join public.google_calendar_events gce
    on gce.assignment_id = sa.id and gce.user_id = sa.user_id
  where sa.status in ('pending', 'confirmed', 'replacement_requested')
    and d.church_id = target_church_id
    and ds.status = 'published'
    and exists (
      select 1 from public.church_memberships cm
      join public.churches c on c.id = cm.church_id and c.status = 'active'
      join public.department_memberships dm on dm.user_id = cm.user_id
        and dm.department_id = ds.department_id and dm.status = 'active'
      where cm.user_id = (select auth.uid()) and cm.church_id = target_church_id
        and cm.status = 'active'
    )
    and d.active
    and s.starts_at >= (
      date_trunc('month', target_month::timestamp)
      at time zone 'America/Sao_Paulo'
    )
    and s.starts_at < (
      (date_trunc('month', target_month::timestamp) + interval '1 month')
      at time zone 'America/Sao_Paulo'
    )
  order by s.starts_at, d.name, p.name;
$$;

revoke all on function public.get_department_calendar_month(uuid, date) from public;
grant execute on function public.get_department_calendar_month(uuid, date) to authenticated;

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
        ds.status = 'published' and d.active
        and exists (
          select 1 from public.church_memberships cm
          join public.department_memberships dm on dm.user_id = cm.user_id
            and dm.department_id = ds.department_id and dm.status = 'active'
          where cm.user_id = (select auth.uid()) and cm.church_id = d.church_id
            and cm.status = 'active'
        )
      )
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
