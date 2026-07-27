-- Adiciona user_id ao retorno de get_batch_team, necessario pra tela de
-- revisao do lote conseguir marcar/desmarcar pessoas direto na lista, sem
-- precisar entrar em cada escala.
drop function if exists public.get_batch_team(uuid);

create or replace function public.get_batch_team(target_batch_id uuid)
returns table (schedule_id uuid, assignment_id uuid, user_id uuid, position_name text, member_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select ds.id, sa.id, sa.user_id, pos.name, p.full_name
  from public.department_schedules ds
  join public.departments d on d.id = ds.department_id
  join public.schedule_assignments sa on sa.department_schedule_id = ds.id
  join public.positions pos on pos.id = sa.position_id
  join public.profiles p on p.id = sa.user_id
  where ds.batch_id = target_batch_id
    and (public.is_assigned_department_leader(ds.department_id) or public.is_church_admin(d.church_id))
  order by ds.id, pos.name, p.full_name;
$$;

revoke all on function public.get_batch_team(uuid) from public;
grant execute on function public.get_batch_team(uuid) to authenticated;
