create or replace function public.validate_department_membership_tenant()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare target_church_id uuid;
begin
  select church_id into target_church_id from public.departments where id = new.department_id;
  if target_church_id is null or not exists (select 1 from public.church_memberships where church_id = target_church_id and user_id = new.user_id and status = 'active') then
    raise exception 'A pessoa precisa ser membro ativo da mesma igreja.';
  end if;
  if new.role = 'leader' and not public.is_church_admin(target_church_id) then
    raise exception 'Apenas a administradora da igreja pode designar líderes.';
  end if;
  return new;
end;
$$;
create trigger validate_department_membership_before_write before insert or update on public.department_memberships for each row execute function public.validate_department_membership_tenant();

create or replace function public.validate_member_position_tenant()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare target_department_id uuid;
begin
  select department_id into target_department_id from public.positions where id = new.position_id;
  if target_department_id is null or not exists (select 1 from public.department_memberships where department_id = target_department_id and user_id = new.user_id and status = 'active') then
    raise exception 'A função precisa pertencer a um setor ativo da pessoa.';
  end if;
  return new;
end;
$$;
create trigger validate_member_position_before_write before insert or update on public.member_positions for each row execute function public.validate_member_position_tenant();

create or replace function public.delete_department_schedule(target_schedule_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_service_id uuid; target_department_id uuid;
begin
  select service_id, department_id into target_service_id, target_department_id from public.department_schedules where id = target_schedule_id;
  if target_service_id is null or not public.is_assigned_department_leader(target_department_id) then raise exception 'Apenas o líder responsável pelo setor pode excluir esta escala.'; end if;
  delete from public.department_schedules where id = target_schedule_id;
  if not exists (select 1 from public.department_schedules where service_id = target_service_id) then delete from public.services where id = target_service_id; end if;
end;
$$;

create or replace function public.notify_schedule_overseers()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; department uuid; schedule_id uuid; member_name text; event_title text;
begin
  select d.church_id, ds.department_id, ds.id, s.title into church, department, schedule_id, event_title
  from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id where ds.id = new.department_schedule_id;
  select full_name into member_name from public.profiles where id = new.user_id;
  if old.status = 'pending' and new.status = 'confirmed' then
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    select recipient, church, 'Presença confirmada', coalesce(member_name, 'Um membro') || ' confirmou presença em ' || event_title || '.', 'member_confirmed', '/painel/escalas/' || schedule_id
    from (
      select dm.user_id recipient from public.department_memberships dm where dm.department_id = department and dm.role = 'leader' and dm.status = 'active'
      union select cm.user_id from public.church_memberships cm where cm.church_id = church and cm.role = 'church_admin' and cm.status = 'active'
    ) recipients where recipient <> (select auth.uid());
  end if;
  return new;
end;
$$;
