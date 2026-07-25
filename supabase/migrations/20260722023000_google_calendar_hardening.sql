-- Google Calendar writes are mediated by RPCs. Direct table writes allowed callers
-- to forge links and made concurrent event creation impossible to coordinate.
drop policy if exists "calendar events insert own" on public.google_calendar_events;
drop policy if exists "calendar events update own" on public.google_calendar_events;
drop policy if exists "calendar events delete own" on public.google_calendar_events;

create table public.google_calendar_sync_locks (
  assignment_id uuid primary key references public.schedule_assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lock_token uuid not null,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.google_calendar_sync_locks enable row level security;

create table public.google_calendar_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  google_event_id text not null,
  reason text not null check (reason in ('assignment_removed', 'assignment_transferred')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, google_event_id)
);
alter table public.google_calendar_cleanup_queue enable row level security;

create or replace function public.claim_my_google_calendar_sync(target_assignment_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare claimant uuid := (select auth.uid()); token uuid := gen_random_uuid(); claimed uuid;
begin
  if not exists (
    select 1 from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    where sa.id = target_assignment_id and sa.user_id = claimant
      and sa.status = 'confirmed' and ds.status = 'published'
  ) then raise exception 'Escala confirmada não encontrada.'; end if;

  insert into public.google_calendar_sync_locks (assignment_id, user_id, lock_token, locked_until)
  values (target_assignment_id, claimant, token, now() + interval '2 minutes')
  on conflict (assignment_id) do update
    set user_id = excluded.user_id, lock_token = excluded.lock_token,
        locked_until = excluded.locked_until, updated_at = now()
    where public.google_calendar_sync_locks.locked_until < now()
       or public.google_calendar_sync_locks.user_id <> claimant
  returning lock_token into claimed;
  return claimed;
end;
$$;

create or replace function public.release_my_google_calendar_sync(target_assignment_id uuid, target_lock_token uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.google_calendar_sync_locks
  where assignment_id = target_assignment_id and user_id = (select auth.uid()) and lock_token = target_lock_token;
$$;

drop function if exists public.save_my_google_calendar_event(uuid, text, text);
create or replace function public.save_my_google_calendar_event(
  target_assignment_id uuid,
  target_google_event_id text,
  target_html_link text,
  target_lock_token uuid
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.google_calendar_sync_locks l on l.assignment_id = sa.id
    where sa.id = target_assignment_id and sa.user_id = (select auth.uid())
      and sa.status = 'confirmed' and ds.status = 'published'
      and l.user_id = (select auth.uid()) and l.lock_token = target_lock_token
      and l.locked_until >= now()
  ) then raise exception 'Sincronização expirada ou sem permissão.'; end if;
  if nullif(trim(target_google_event_id), '') is null then raise exception 'Evento Google inválido.'; end if;

  insert into public.google_calendar_events (user_id, assignment_id, google_event_id, html_link)
  values ((select auth.uid()), target_assignment_id, trim(target_google_event_id), nullif(trim(target_html_link), ''))
  on conflict (user_id, assignment_id) do update
  set google_event_id = excluded.google_event_id, html_link = excluded.html_link, updated_at = now();
end;
$$;

create or replace function public.get_my_pending_google_calendar_cleanup()
returns table (cleanup_id uuid, google_event_id text)
language sql stable security definer set search_path = ''
as $$
  select id, google_event_id from public.google_calendar_cleanup_queue
  where user_id = (select auth.uid()) and completed_at is null order by created_at limit 50;
$$;

create or replace function public.complete_my_google_calendar_cleanup(target_cleanup_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.google_calendar_cleanup_queue set completed_at = now()
  where id = target_cleanup_id and user_id = (select auth.uid()) and completed_at is null;
$$;

create or replace function public.queue_google_calendar_cleanup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare cleanup_reason text;
begin
  if tg_op = 'DELETE' then
    cleanup_reason := 'assignment_removed';
  elsif old.user_id is distinct from new.user_id then
    cleanup_reason := 'assignment_transferred';
  elsif old.status in ('pending', 'confirmed', 'replacement_requested')
    and new.status not in ('pending', 'confirmed', 'replacement_requested') then
    cleanup_reason := 'assignment_removed';
  end if;

  if cleanup_reason is not null then
    insert into public.google_calendar_cleanup_queue (user_id, google_event_id, reason)
    select gce.user_id, gce.google_event_id, cleanup_reason
    from public.google_calendar_events gce where gce.assignment_id = old.id
    on conflict (user_id, google_event_id) do update set completed_at = null;
    delete from public.google_calendar_events where assignment_id = old.id;
    delete from public.google_calendar_sync_locks where assignment_id = old.id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger queue_google_cleanup_before_assignment_change
before delete or update of user_id, status on public.schedule_assignments
for each row execute function public.queue_google_calendar_cleanup();

revoke all on table public.google_calendar_sync_locks from authenticated;
revoke all on table public.google_calendar_cleanup_queue from authenticated;
revoke all on function public.claim_my_google_calendar_sync(uuid) from public;
revoke all on function public.release_my_google_calendar_sync(uuid, uuid) from public;
revoke all on function public.save_my_google_calendar_event(uuid, text, text, uuid) from public;
revoke all on function public.get_my_pending_google_calendar_cleanup() from public;
revoke all on function public.complete_my_google_calendar_cleanup(uuid) from public;
grant execute on function public.claim_my_google_calendar_sync(uuid) to authenticated;
grant execute on function public.release_my_google_calendar_sync(uuid, uuid) to authenticated;
grant execute on function public.save_my_google_calendar_event(uuid, text, text, uuid) to authenticated;
grant execute on function public.get_my_pending_google_calendar_cleanup() to authenticated;
grant execute on function public.complete_my_google_calendar_cleanup(uuid) to authenticated;
