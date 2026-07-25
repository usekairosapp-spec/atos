create or replace function public.can_view_department_schedule(target_schedule_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.department_schedules ds join public.departments d on d.id = ds.department_id
    where ds.id = target_schedule_id and (
      public.is_church_admin(d.church_id)
      or public.is_assigned_department_leader(ds.department_id)
      or (
        ds.status = 'published'
        and (
          exists (select 1 from public.schedule_assignments sa where sa.department_schedule_id = ds.id and sa.user_id = (select auth.uid()))
          or exists (
            select 1 from public.swap_requests sr join public.schedule_assignments sa on sa.id = sr.assignment_id
            where sa.department_schedule_id = ds.id and sr.suggested_user_id = (select auth.uid()) and sr.status = 'pending'
          )
        )
      )
    )
  );
$$;

create or replace function public.can_view_schedule_service(target_service_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.department_schedules ds where ds.service_id = target_service_id and public.can_view_department_schedule(ds.id));
$$;
