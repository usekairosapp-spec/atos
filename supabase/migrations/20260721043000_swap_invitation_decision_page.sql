create or replace function public.get_my_swap_invitation(target_request_id uuid)
returns table (
  request_id uuid, requester_name text, reason text, schedule_id uuid,
  service_title text, service_starts_at timestamptz, department_name text, position_name text
)
language sql stable security definer set search_path = ''
as $$
  select sr.id, p.full_name, sr.reason, ds.id, s.title, s.starts_at, d.name, pos.name
  from public.swap_requests sr
  join public.profiles p on p.id = sr.requested_by
  join public.schedule_assignments sa on sa.id = sr.assignment_id
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  join public.departments d on d.id = ds.department_id
  join public.positions pos on pos.id = sa.position_id
  where sr.id = target_request_id
    and sr.suggested_user_id = (select auth.uid())
    and sr.status = 'pending'
    and ds.status = 'published'
  limit 1;
$$;

revoke all on function public.get_my_swap_invitation(uuid) from public;
grant execute on function public.get_my_swap_invitation(uuid) to authenticated;

create or replace function public.notify_swap_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare church uuid; schedule_id uuid; requester_name text;
begin
  select d.church_id, ds.id into church, schedule_id from public.schedule_assignments sa join public.department_schedules ds on ds.id = sa.department_schedule_id join public.departments d on d.id = ds.department_id where sa.id = new.assignment_id;
  if tg_op = 'INSERT' then
    select full_name into requester_name from public.profiles where id = new.requested_by;
    insert into public.notifications (user_id, church_id, title, body, kind, href) values (new.suggested_user_id, church, 'Convite para troca', coalesce(requester_name, 'Um membro') || ' quer trocar uma escala com você.', 'swap_invite', '/painel/trocas/' || new.id);
  elsif old.status = 'pending' and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, church_id, title, body, kind, href) values (new.requested_by, church, case when new.status = 'accepted' then 'Troca aceita' else 'Troca recusada' end, case when new.status = 'accepted' then 'Sua solicitação de troca foi aceita.' else 'Sua solicitação de troca foi recusada.' end, case when new.status = 'accepted' then 'swap_accepted' else 'swap_rejected' end, '/painel/escalas/' || schedule_id);
  end if;
  return new;
end;
$$;

insert into public.notifications (user_id, church_id, title, body, kind, href)
select sr.suggested_user_id, d.church_id, 'Convite para troca', coalesce(p.full_name, 'Um membro') || ' quer trocar uma escala com você.', 'swap_invite', '/painel/trocas/' || sr.id
from public.swap_requests sr
join public.profiles p on p.id = sr.requested_by
join public.schedule_assignments sa on sa.id = sr.assignment_id
join public.department_schedules ds on ds.id = sa.department_schedule_id
join public.departments d on d.id = ds.department_id
where sr.status = 'pending'
  and not exists (select 1 from public.notifications n where n.user_id = sr.suggested_user_id and n.href = '/painel/trocas/' || sr.id);
