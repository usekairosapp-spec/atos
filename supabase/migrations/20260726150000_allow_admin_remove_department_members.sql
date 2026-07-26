-- Permite que admins da igreja removam membros dos departamentos
drop policy if exists "department memberships managed by leaders" on public.department_memberships;

create policy "department memberships managed by leaders or church admins" on public.department_memberships
for all to authenticated using (
  public.is_department_leader(department_id) or
  public.is_church_admin(
    (select church_id from public.departments where id = department_id)
  )
)
with check (
  public.is_department_leader(department_id) or
  public.is_church_admin(
    (select church_id from public.departments where id = department_id)
  )
);
