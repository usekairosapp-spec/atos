alter table public.notifications add column if not exists event_key text;
update public.notifications set event_key = 'legacy:' || id where event_key is null;
alter table public.notifications alter column event_key set default gen_random_uuid()::text;
alter table public.notifications alter column event_key set not null;
alter table public.notifications add constraint notifications_user_event_key_unique unique (user_id, event_key);

create or replace function public.notify_assignment_on_publish()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; event_title text;
begin
  if old.status = 'draft' and new.status = 'published' then
    select d.church_id, s.title into church, event_title from public.departments d join public.services s on s.id = new.service_id where d.id = new.department_id;
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select sa.user_id, church, 'Nova escala publicada', 'Você foi escalado(a) para ' || event_title || '.', 'schedule_published', '/painel/escalas/' || new.id, 'schedule:' || new.id || ':published'
    from public.schedule_assignments sa where sa.department_schedule_id = new.id
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.notify_new_published_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; event_title text; schedule_status public.schedule_status;
begin
  select d.church_id, s.title, ds.status into church, event_title, schedule_status from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id where ds.id = new.department_schedule_id;
  if schedule_status = 'published' then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    values (new.user_id, church, 'Você foi incluído em uma escala', event_title || ' aguarda sua confirmação.', 'schedule_added', '/painel/escalas/' || new.department_schedule_id, 'assignment:' || new.id || ':added')
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.notify_swap_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; schedule_id uuid; requester_name text;
begin
  select d.church_id, ds.id into church, schedule_id from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id where sa.id = new.assignment_id;
  if tg_op = 'INSERT' then
    select full_name into requester_name from public.profiles where id = new.requested_by;
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    values (new.suggested_user_id, church, 'Convite para troca', coalesce(requester_name, 'Um membro') || ' quer trocar uma escala com você.', 'swap_invite', '/painel/trocas/' || new.id, 'swap:' || new.id || ':invite')
    on conflict (user_id, event_key) do nothing;
  elsif old.status = 'pending' and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    values (new.requested_by, church, case when new.status = 'accepted' then 'Troca aceita' else 'Troca recusada' end, case when new.status = 'accepted' then 'Sua solicitação de troca foi aceita.' else 'Sua solicitação de troca foi recusada.' end, case when new.status = 'accepted' then 'swap_accepted' else 'swap_rejected' end, '/painel/escalas/' || schedule_id, 'swap:' || new.id || ':' || new.status)
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.notify_schedule_overseers()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; department uuid; schedule_id uuid; member_name text; event_title text;
begin
  select d.church_id, ds.department_id, ds.id, s.title into church, department, schedule_id, event_title from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id where ds.id = new.department_schedule_id;
  select full_name into member_name from public.profiles where id = new.user_id;
  if old.status = 'pending' and new.status = 'confirmed' then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select recipient, church, 'Presença confirmada', coalesce(member_name, 'Um membro') || ' confirmou presença em ' || event_title || '.', 'member_confirmed', '/painel/escalas/' || schedule_id, 'assignment:' || new.id || ':confirmed'
    from (select dm.user_id recipient from public.department_memberships dm where dm.department_id = department and dm.role = 'leader' and dm.status = 'active' union select cm.user_id from public.church_memberships cm where cm.church_id = church and cm.role = 'church_admin' and cm.status = 'active') recipients
    where recipient <> (select auth.uid()) on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.notify_overseers_on_swap()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; department uuid; schedule_id uuid; member_name text;
begin
  select d.church_id, ds.department_id, ds.id into church, department, schedule_id from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id where sa.id = new.assignment_id;
  select full_name into member_name from public.profiles where id = new.requested_by;
  insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
  select recipient, church, 'Troca solicitada', coalesce(member_name, 'Um membro') || ' iniciou uma troca de escala.', 'swap_requested', '/painel/escalas/' || schedule_id, 'swap:' || new.id || ':overseer'
  from (select dm.user_id recipient from public.department_memberships dm where dm.department_id = department and dm.role = 'leader' and dm.status = 'active' union select cm.user_id from public.church_memberships cm where cm.church_id = church and cm.role = 'church_admin' and cm.status = 'active') recipients
  where recipient <> new.requested_by on conflict (user_id, event_key) do nothing;
  return new;
end;
$$;
