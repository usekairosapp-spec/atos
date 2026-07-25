alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('schedule_published', 'schedule_added', 'swap_invite', 'swap_accepted', 'swap_rejected', 'member_confirmed', 'swap_requested')
);

create or replace function public.notify_schedule_overseers()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; department uuid; schedule_id uuid; member_name text; event_title text;
begin
  select d.church_id, ds.department_id, ds.id, s.title into church, department, schedule_id, event_title
  from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id
  where ds.id = new.department_schedule_id;
  select full_name into member_name from public.profiles where id = new.user_id;
  if old.status <> 'confirmed' and new.status = 'confirmed' then
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    select recipient, church, 'Presença confirmada', coalesce(member_name, 'Um membro') || ' confirmou presença em ' || event_title || '.', 'member_confirmed', '/painel/escalas/' || schedule_id
    from (
      select dm.user_id recipient from public.department_memberships dm where dm.department_id = department and dm.role = 'leader' and dm.status = 'active'
      union
      select cm.user_id from public.church_memberships cm where cm.church_id = church and cm.role = 'church_admin' and cm.status = 'active'
    ) recipients where recipient <> (select auth.uid());
  end if;
  return new;
end;
$$;
create trigger notify_overseers_on_confirmation after update of status on public.schedule_assignments for each row execute function public.notify_schedule_overseers();

create or replace function public.notify_overseers_on_swap()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; department uuid; schedule_id uuid; member_name text;
begin
  select d.church_id, ds.department_id, ds.id into church, department, schedule_id
  from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id
  where sa.id = new.assignment_id;
  select full_name into member_name from public.profiles where id = new.requested_by;
  insert into public.notifications (user_id, church_id, title, body, kind, href)
  select recipient, church, 'Troca solicitada', coalesce(member_name, 'Um membro') || ' iniciou uma troca de escala.', 'swap_requested', '/painel/escalas/' || schedule_id
  from (
    select dm.user_id recipient from public.department_memberships dm where dm.department_id = department and dm.role = 'leader' and dm.status = 'active'
    union
    select cm.user_id from public.church_memberships cm where cm.church_id = church and cm.role = 'church_admin' and cm.status = 'active'
  ) recipients where recipient <> new.requested_by;
  return new;
end;
$$;
create trigger notify_overseers_on_swap_request after insert on public.swap_requests for each row execute function public.notify_overseers_on_swap();
