-- Apaga um comunicado (e as notificacoes associadas). Somente quem criou
-- o comunicado ou a administradora da igreja podem apagar.
create or replace function public.delete_announcement(target_announcement_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  ann record;
begin
  select id, church_id, created_by into ann from public.announcements where id = target_announcement_id;
  if ann.id is null then
    raise exception 'Comunicado não encontrado.';
  end if;
  if not (ann.created_by = actor_id or public.is_church_admin(ann.church_id)) then
    raise exception 'Sem permissão para apagar este comunicado.';
  end if;

  delete from public.notifications
  where kind = 'announcement' and href = '/painel/comunicados/' || target_announcement_id::text;

  delete from public.announcements where id = target_announcement_id;
end;
$$;

revoke all on function public.delete_announcement(uuid) from public;
grant execute on function public.delete_announcement(uuid) to authenticated;
