create or replace function public.save_my_google_calendar_event(
  target_assignment_id uuid,
  target_google_event_id text,
  target_html_link text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    where sa.id = target_assignment_id
      and sa.user_id = (select auth.uid())
      and sa.status = 'confirmed'
      and ds.status = 'published'
  ) then
    raise exception 'Escala confirmada não encontrada.';
  end if;

  insert into public.google_calendar_events (user_id, assignment_id, google_event_id, html_link)
  values ((select auth.uid()), target_assignment_id, target_google_event_id, target_html_link)
  on conflict (user_id, assignment_id) do update
  set google_event_id = excluded.google_event_id,
      html_link = excluded.html_link,
      updated_at = now();
end;
$$;

revoke all on function public.save_my_google_calendar_event(uuid, text, text) from public;
grant execute on function public.save_my_google_calendar_event(uuid, text, text) to authenticated;
