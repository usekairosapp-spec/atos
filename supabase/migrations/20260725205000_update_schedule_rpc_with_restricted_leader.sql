-- Atualiza as RPCs de escala para garantir que usam a função restrita
-- de verificação de líder (sem a brecha que permitia church_admin)

create or replace function public.create_department_schedule(
  target_department_id uuid,
  schedule_title text,
  schedule_starts_at timestamptz,
  schedule_ends_at timestamptz,
  schedule_location text,
  schedule_notes text
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  target_church_id uuid;
  new_service_id uuid;
  new_schedule_id uuid;
begin
  -- Verifica se o usuário é líder do departamento (restrito a este setor)
  if not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder atribuído pode criar escalas para este setor.';
  end if;
  if schedule_ends_at <= schedule_starts_at then
    raise exception 'O horário final deve ser posterior ao inicial.';
  end if;
  select church_id into target_church_id from public.departments where id = target_department_id and active;
  if target_church_id is null then raise exception 'Setor não encontrado.'; end if;

  insert into public.services (church_id, title, starts_at, ends_at, location, notes, created_by)
  values (target_church_id, trim(schedule_title), schedule_starts_at, schedule_ends_at, nullif(trim(schedule_location), ''), nullif(trim(schedule_notes), ''), (select auth.uid()))
  returning id into new_service_id;

  insert into public.department_schedules (service_id, department_id, created_by)
  values (new_service_id, target_department_id, (select auth.uid()))
  returning id into new_schedule_id;

  return new_schedule_id;
end;
$$;

create or replace function public.add_schedule_assignment(
  target_schedule_id uuid,
  target_position_id uuid,
  target_user_id uuid
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
  new_assignment_id uuid;
begin
  select department_id into target_department_id from public.department_schedules where id = target_schedule_id;
  -- Verifica se o usuário é líder do departamento específico (não apenas church_admin)
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para alterar esta escala.';
  end if;
  if not exists (select 1 from public.positions where id = target_position_id and department_id = target_department_id and active) then
    raise exception 'Função inválida para este setor.';
  end if;
  if not exists (select 1 from public.department_memberships where department_id = target_department_id and user_id = target_user_id and status = 'active') then
    raise exception 'A pessoa precisa ser membro ativo do setor.';
  end if;

  insert into public.schedule_assignments (department_schedule_id, position_id, user_id, assigned_by)
  values (target_schedule_id, target_position_id, target_user_id, (select auth.uid()))
  returning id into new_assignment_id;
  return new_assignment_id;
end;
$$;

create or replace function public.publish_department_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
begin
  select department_id into target_department_id from public.department_schedules where id = target_schedule_id;
  -- Verifica se o usuário é líder do departamento específico (não apenas church_admin)
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para publicar esta escala.';
  end if;
  if not exists (select 1 from public.schedule_assignments where department_schedule_id = target_schedule_id) then
    raise exception 'Adicione pelo menos uma pessoa antes de publicar.';
  end if;
  update public.department_schedules set status = 'published', published_at = now(), updated_at = now() where id = target_schedule_id;
end;
$$;

create or replace function public.delete_schedule(target_schedule_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
begin
  select department_id into target_department_id from public.department_schedules where id = target_schedule_id;
  -- Verifica se o usuário é líder do departamento específico (não apenas church_admin)
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para deletar esta escala.';
  end if;
  delete from public.department_schedules where id = target_schedule_id;
end;
$$;

create or replace function public.remove_schedule_assignment(target_assignment_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
begin
  select ds.department_id into target_department_id
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  where sa.id = target_assignment_id;

  -- Verifica se o usuário é líder do departamento específico (não apenas church_admin)
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Sem permissão para alterar esta escala.';
  end if;

  delete from public.schedule_assignments where id = target_assignment_id;
end;
$$;
