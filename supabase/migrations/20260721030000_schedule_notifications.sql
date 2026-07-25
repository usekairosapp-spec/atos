create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  church_id uuid not null references public.churches(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null check (kind in ('schedule_published', 'schedule_added', 'swap_invite', 'swap_accepted', 'swap_rejected')),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notifications read by owner" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications updated by owner" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create or replace function public.notify_assignment_on_publish()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; event_title text;
begin
  if old.status = 'draft' and new.status = 'published' then
    select d.church_id, s.title into church, event_title from public.departments d join public.services s on s.id = new.service_id where d.id = new.department_id;
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    select sa.user_id, church, 'Nova escala publicada', 'Você foi escalado(a) para ' || event_title || '.', 'schedule_published', '/painel/escalas/' || new.id
    from public.schedule_assignments sa where sa.department_schedule_id = new.id;
  end if;
  return new;
end;
$$;
create trigger notify_on_schedule_publish after update of status on public.department_schedules for each row execute function public.notify_assignment_on_publish();

create or replace function public.notify_new_published_assignment()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; event_title text; schedule_status public.schedule_status;
begin
  select d.church_id, s.title, ds.status into church, event_title, schedule_status
  from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id
  where ds.id = new.department_schedule_id;
  if schedule_status = 'published' then
    insert into public.notifications (user_id, church_id, title, body, kind, href)
    values (new.user_id, church, 'Você foi incluído em uma escala', event_title || ' aguarda sua confirmação.', 'schedule_added', '/painel/escalas/' || new.department_schedule_id);
  end if;
  return new;
end;
$$;
create trigger notify_on_published_assignment after insert on public.schedule_assignments for each row execute function public.notify_new_published_assignment();

create or replace function public.notify_swap_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; schedule_id uuid; requester_name text;
begin
  select d.church_id, ds.id into church, schedule_id from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id where sa.id = new.assignment_id;
  if tg_op = 'INSERT' then
    select full_name into requester_name from public.profiles where id = new.requested_by;
    insert into public.notifications (user_id, church_id, title, body, kind, href) values (new.suggested_user_id, church, 'Convite para troca', coalesce(requester_name, 'Um membro') || ' quer trocar uma escala com você.', 'swap_invite', '/painel/escalas/' || schedule_id);
  elsif old.status = 'pending' and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, church_id, title, body, kind, href) values (new.requested_by, church, case when new.status = 'accepted' then 'Troca aceita' else 'Troca recusada' end, case when new.status = 'accepted' then 'Sua solicitação de troca foi aceita.' else 'Sua solicitação de troca foi recusada.' end, case when new.status = 'accepted' then 'swap_accepted' else 'swap_rejected' end, '/painel/escalas/' || schedule_id);
  end if;
  return new;
end;
$$;
create trigger notify_on_swap_insert after insert on public.swap_requests for each row execute function public.notify_swap_changes();
create trigger notify_on_swap_update after update of status on public.swap_requests for each row execute function public.notify_swap_changes();
