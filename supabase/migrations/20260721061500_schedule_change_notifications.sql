alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in ('schedule_published', 'schedule_added', 'schedule_updated', 'schedule_deleted', 'swap_invite', 'swap_accepted', 'swap_rejected', 'member_confirmed', 'swap_requested')
);

create or replace function public.update_department_schedule(target_schedule_id uuid, schedule_title text, schedule_starts_at timestamptz, schedule_ends_at timestamptz, schedule_location text, schedule_notes text)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_department_id uuid; target_service_id uuid; target_church_id uuid; current_status public.schedule_status; change_key text := gen_random_uuid()::text;
begin
  select ds.department_id, ds.service_id, d.church_id, ds.status into target_department_id, target_service_id, target_church_id, current_status
  from public.department_schedules ds join public.departments d on d.id = ds.department_id where ds.id = target_schedule_id;
  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then raise exception 'Sem permissão para editar esta escala.'; end if;
  if schedule_ends_at <= schedule_starts_at then raise exception 'O término deve ser posterior ao início.'; end if;
  if (select count(*) from public.department_schedules where service_id = target_service_id) > 1 then raise exception 'Este culto é compartilhado entre setores e não pode ser alterado por um único líder.'; end if;
  update public.services set title = trim(schedule_title), starts_at = schedule_starts_at, ends_at = schedule_ends_at, location = nullif(trim(schedule_location), ''), notes = nullif(trim(schedule_notes), ''), updated_at = now() where id = target_service_id;
  if current_status = 'published' then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select sa.user_id, target_church_id, 'Escala atualizada', trim(schedule_title) || ' teve seus dados alterados.', 'schedule_updated', '/painel/escalas/' || target_schedule_id, 'schedule:' || target_schedule_id || ':updated:' || change_key
    from public.schedule_assignments sa where sa.department_schedule_id = target_schedule_id
    on conflict (user_id, event_key) do nothing;
  end if;
end;
$$;

create or replace function public.delete_department_schedule(target_schedule_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_service_id uuid; target_department_id uuid; target_church_id uuid; event_title text; current_status public.schedule_status;
begin
  select ds.service_id, ds.department_id, d.church_id, s.title, ds.status into target_service_id, target_department_id, target_church_id, event_title, current_status
  from public.department_schedules ds join public.departments d on d.id = ds.department_id join public.services s on s.id = ds.service_id where ds.id = target_schedule_id;
  if target_service_id is null or not public.is_assigned_department_leader(target_department_id) then raise exception 'Apenas o líder responsável pelo setor pode excluir esta escala.'; end if;
  if current_status = 'published' then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select sa.user_id, target_church_id, 'Escala cancelada', event_title || ' foi cancelada pelo líder.', 'schedule_deleted', '/painel', 'schedule:' || target_schedule_id || ':deleted'
    from public.schedule_assignments sa where sa.department_schedule_id = target_schedule_id
    on conflict (user_id, event_key) do nothing;
  end if;
  delete from public.department_schedules where id = target_schedule_id;
  if not exists (select 1 from public.department_schedules where service_id = target_service_id) then delete from public.services where id = target_service_id; end if;
end;
$$;
