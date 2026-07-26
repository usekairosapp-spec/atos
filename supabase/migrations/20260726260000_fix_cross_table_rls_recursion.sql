-- A correcao anterior nao foi suficiente: can_view_department_schedule (usada na
-- politica de department_schedules) consulta schedule_assignments, e
-- is_active_schedule_participant (usada na politica de schedule_assignments)
-- consulta department_schedules. Como ambas sao "language sql", o planner pode
-- fazer inline das duas dentro uma da outra, criando um ciclo entre as duas
-- politicas. Funcoes "language plpgsql" nunca sao inlineadas pelo planner,
-- entao convertemos as duas para plpgsql, o que preserva o isolamento do
-- security definer e elimina a recursao cruzada.

create or replace function public.is_active_schedule_participant(p_department_schedule_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    join public.churches c on c.id = d.church_id
    join public.church_memberships cm
      on cm.church_id = d.church_id
     and cm.user_id = p_user_id
     and cm.status = 'active'
    join public.department_memberships dm
      on dm.department_id = d.id
     and dm.user_id = p_user_id
     and dm.status = 'active'
    where ds.id = p_department_schedule_id
      and c.status = 'active'
      and d.active
  );
end;
$$;

create or replace function public.can_view_department_schedule(target_schedule_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    join public.churches c on c.id = d.church_id
    where ds.id = target_schedule_id
      and c.status = 'active'
      and d.active
      and (
        public.is_church_admin(d.church_id)
        or public.is_assigned_department_leader(ds.department_id)
        or (
          ds.status = 'published'
          and exists (
            select 1
            from public.church_memberships cm
            where cm.church_id = d.church_id
              and cm.user_id = (select auth.uid())
              and cm.status = 'active'
          )
          and (
            exists (
              select 1
              from public.schedule_assignments sa
              join public.department_memberships dm
                on dm.department_id = d.id
               and dm.user_id = sa.user_id
               and dm.status = 'active'
              where sa.department_schedule_id = ds.id
                and sa.user_id = (select auth.uid())
            )
            or exists (
              select 1
              from public.swap_requests sr
              join public.schedule_assignments sa on sa.id = sr.assignment_id
              join public.department_memberships dm
                on dm.department_id = d.id
               and dm.user_id = sr.suggested_user_id
               and dm.status = 'active'
              where sa.department_schedule_id = ds.id
                and sr.suggested_user_id = (select auth.uid())
                and sr.status = 'pending'
            )
          )
        )
      )
  );
end;
$$;
