create or replace function public.can_view_schedule_service(target_service_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    where ds.service_id = target_service_id
      and (
        public.is_church_admin(d.church_id)
        or public.is_assigned_department_leader(ds.department_id)
        or exists (
          select 1
          from public.schedule_assignments sa
          where sa.department_schedule_id = ds.id
            and sa.user_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function public.can_view_schedule_service(uuid) from public;
grant execute on function public.can_view_schedule_service(uuid) to authenticated;

drop policy if exists "services read by schedule viewers" on public.services;
create policy "services read by schedule viewers"
on public.services for select to authenticated
using (public.can_view_schedule_service(id));
