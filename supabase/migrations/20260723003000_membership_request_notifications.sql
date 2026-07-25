alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('schedule_published', 'schedule_added', 'schedule_updated', 'schedule_deleted', 'swap_invite', 'swap_accepted', 'swap_rejected', 'member_confirmed', 'swap_requested', 'member_removed', 'membership_requested', 'membership_approved', 'membership_rejected')
);

create or replace function public.notify_membership_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_name text;
begin
  select full_name into member_name from public.profiles where id = new.user_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select cm.user_id, new.church_id, 'Nova solicitação de membro', coalesce(nullif(member_name, ''), 'Uma pessoa') || ' pediu para entrar na igreja.', 'membership_requested', '/painel/membros', 'membership:' || new.id || ':request:' || extract(epoch from new.updated_at)::text
    from public.church_memberships cm
    where cm.church_id = new.church_id and cm.role = 'church_admin' and cm.status = 'active' and cm.user_id <> new.user_id
    on conflict (user_id, event_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('active', 'rejected') then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    values (new.user_id, new.church_id,
      case when new.status = 'active' then 'Entrada aprovada' else 'Solicitação recusada' end,
      case when new.status = 'active' then 'Sua entrada na igreja foi aprovada.' else 'Sua solicitação de entrada não foi aprovada.' end,
      case when new.status = 'active' then 'membership_approved' else 'membership_rejected' end,
      '/painel', 'membership:' || new.id || ':' || new.status::text)
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_membership_change on public.church_memberships;
create trigger notify_on_membership_change after insert or update of status on public.church_memberships
for each row execute function public.notify_membership_changes();

insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
select admin.user_id, pending.church_id, 'Solicitação aguardando aprovação', coalesce(nullif(p.full_name, ''), 'Uma pessoa') || ' está aguardando aprovação.', 'membership_requested', '/painel/membros', 'membership:' || pending.id || ':pending-backfill'
from public.church_memberships pending
join public.profiles p on p.id = pending.user_id
join public.church_memberships admin on admin.church_id = pending.church_id and admin.role = 'church_admin' and admin.status = 'active'
where pending.status = 'pending' and admin.user_id <> pending.user_id
on conflict (user_id, event_key) do nothing;

create or replace function public.mark_church_notifications_read(target_church_id uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.notifications set read_at = coalesce(read_at, now())
  where user_id = (select auth.uid()) and church_id = target_church_id and read_at is null
    and public.is_active_church_member(target_church_id);
$$;
revoke all on function public.mark_church_notifications_read(uuid) from public;
grant execute on function public.mark_church_notifications_read(uuid) to authenticated;

