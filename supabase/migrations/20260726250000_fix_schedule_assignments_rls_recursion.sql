-- Corrige "infinite recursion detected in policy for relation schedule_assignments".
-- A politica de SELECT chamava is_active_assignment_owner(id), uma funcao "language sql"
-- que consulta a propria tabela schedule_assignments; o planner do Postgres pode
-- fazer inline dessa funcao dentro da politica (por ser uma chamada correlacionada
-- simples), criando uma subquery autorreferente que dispara recursao ao reavaliar
-- a mesma politica. Isso so aparecia em consultas diretas na tabela (ex.: a pagina
-- inicial), nao em RPCs (que ja rodam com RLS ignorada por serem security definer).
--
-- A correcao usa uma funcao que recebe department_schedule_id e user_id diretamente
-- (colunas ja disponiveis na propria linha sendo filtrada), sem reconsultar
-- schedule_assignments, eliminando a autorreferencia.

create or replace function public.is_active_schedule_participant(p_department_schedule_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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
$$;

revoke all on function public.is_active_schedule_participant(uuid, uuid) from public;
grant execute on function public.is_active_schedule_participant(uuid, uuid) to authenticated;

drop policy if exists "assignments read by authorized users" on public.schedule_assignments;
create policy "assignments read by authorized users"
on public.schedule_assignments
for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and public.is_active_schedule_participant(department_schedule_id, user_id)
  )
  or exists (
    select 1
    from public.swap_requests sr
    join public.department_schedules ds on ds.id = department_schedule_id
    join public.departments d on d.id = ds.department_id
    join public.church_memberships cm
      on cm.church_id = d.church_id
     and cm.user_id = (select auth.uid())
     and cm.status = 'active'
    join public.department_memberships dm
      on dm.department_id = d.id
     and dm.user_id = (select auth.uid())
     and dm.status = 'active'
    join public.churches c on c.id = d.church_id and c.status = 'active'
    where sr.assignment_id = schedule_assignments.id
      and sr.suggested_user_id = (select auth.uid())
      and sr.status = 'pending'
  )
  or exists (
    select 1
    from public.department_schedules ds
    join public.departments d on d.id = ds.department_id
    where ds.id = schedule_assignments.department_schedule_id
      and (
        public.is_assigned_department_leader(ds.department_id)
        or public.is_church_admin(d.church_id)
      )
  )
);
