-- Ate aqui, so o lider atribuido do setor podia criar/editar/arquivar
-- funcoes (positions) — nem o admin da igreja conseguia, a nao ser que
-- tambem fosse o lider daquele setor especifico. Passa a permitir tambem
-- o admin da igreja, em qualquer setor dela.
create or replace function public.is_department_admin_or_leader(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_assigned_department_leader(target_department_id)
    or exists (
      select 1 from public.departments d
      where d.id = target_department_id
        and public.is_church_admin(d.church_id)
    );
$$;

drop policy if exists "positions managed by assigned department leaders" on public.positions;
create policy "positions managed by leaders or church admins" on public.positions
  for all
  using (public.is_department_admin_or_leader(department_id))
  with check (public.is_department_admin_or_leader(department_id));
