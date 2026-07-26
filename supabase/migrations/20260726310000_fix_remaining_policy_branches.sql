-- As condicoes 2 e 3 da politica de schedule_assignments faziam "FROM
-- department_schedules" diretamente dentro do USING (sem passar por uma
-- funcao), o que ainda dispara a recursao mesmo com a condicao 1 corrigida:
-- ao consultar department_schedules a partir de dentro da politica de
-- schedule_assignments (papel authenticated, sem bypass), a politica de
-- department_schedules e avaliada, que por sua vez consulta schedule_assignments
-- de novo enquanto a resolucao da politica original ainda esta em andamento.
-- Encapsulando essas consultas em funcoes security definer (que executam como
-- postgres, com bypassrls), a consulta a department_schedules nunca chega a
-- avaliar a politica dela, eliminando o ciclo.

create or replace function public.is_pending_swap_target(p_assignment_id uuid, p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.swap_requests sr
    join public.schedule_assignments sa on sa.id = sr.assignment_id
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.departments d on d.id = ds.department_id
    join public.church_memberships cm
      on cm.church_id = d.church_id
     and cm.user_id = p_user_id
     and cm.status = 'active'
    join public.department_memberships dm
      on dm.department_id = d.id
     and dm.user_id = p_user_id
     and dm.status = 'active'
    join public.churches c on c.id = d.church_id and c.status = 'active'
    where sr.assignment_id = p_assignment_id
      and sr.suggested_user_id = p_user_id
      and sr.status = 'pending'
  );
end;
$$;

revoke all on function public.is_pending_swap_target(uuid, uuid) from public;
grant execute on function public.is_pending_swap_target(uuid, uuid) to authenticated;

create or replace function public.is_schedule_leader_or_admin(p_department_schedule_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_department_id uuid;
  v_church_id uuid;
begin
  select ds.department_id into v_department_id from public.department_schedules ds where ds.id = p_department_schedule_id;
  if v_department_id is null then
    return false;
  end if;
  select d.church_id into v_church_id from public.departments d where d.id = v_department_id;
  return public.is_assigned_department_leader(v_department_id) or public.is_church_admin(v_church_id);
end;
$$;

revoke all on function public.is_schedule_leader_or_admin(uuid) from public;
grant execute on function public.is_schedule_leader_or_admin(uuid) to authenticated;

drop policy if exists "assignments read by authorized users" on public.schedule_assignments;
create policy "assignments read by authorized users"
on public.schedule_assignments
for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and public.is_active_schedule_participant(department_schedule_id, user_id)
  )
  or public.is_pending_swap_target(id, (select auth.uid()))
  or public.is_schedule_leader_or_admin(department_schedule_id)
);
