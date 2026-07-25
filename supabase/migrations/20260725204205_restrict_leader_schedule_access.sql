-- Restringe líder de setor a apenas seu setor, mesmo se for church_admin
create or replace function public.is_assigned_department_leader(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.departments d
    join public.churches c on c.id = d.church_id
    where d.id = target_department_id
      and d.active
      and c.status = 'active'
      and exists (
        select 1
        from public.department_memberships dm
        join public.church_memberships cm
          on cm.church_id = d.church_id
         and cm.user_id = dm.user_id
        where dm.department_id = d.id
          and dm.user_id = (select auth.uid())
          and dm.role = 'leader'
          and dm.status = 'active'
          and cm.status = 'active'
      )
  );
$$;

revoke all on function public.is_assigned_department_leader(uuid) from public;
grant execute on function public.is_assigned_department_leader(uuid) to authenticated;
