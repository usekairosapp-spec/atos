-- A administradora da plataforma precisa enxergar os vínculos para a Central,
-- sem receber autoridade operacional sobre a igreja.
drop policy if exists "memberships read self or church admin" on public.church_memberships;
create policy "memberships read self church admin or platform admin"
on public.church_memberships
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_church_admin(church_id)
  or public.is_platform_admin()
);

