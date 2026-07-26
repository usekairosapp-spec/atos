-- Apagar um comunicado agora e permitido somente para quem o escreveu.
create or replace function public.delete_announcement(target_announcement_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  ann record;
begin
  select id, created_by into ann from public.announcements where id = target_announcement_id;
  if ann.id is null then
    raise exception 'Comunicado não encontrado.';
  end if;
  if ann.created_by <> actor_id then
    raise exception 'Somente quem escreveu o comunicado pode apagá-lo.';
  end if;

  delete from public.notifications
  where kind = 'announcement' and href = '/painel/comunicados/' || target_announcement_id::text;

  delete from public.announcements where id = target_announcement_id;
end;
$$;
