delete from public.notifications old_notification
where old_notification.kind = 'swap_invite'
  and old_notification.href like '/painel/escalas/%'
  and exists (
    select 1 from public.notifications new_notification
    where new_notification.user_id = old_notification.user_id
      and new_notification.kind = 'swap_invite'
      and new_notification.body = old_notification.body
      and new_notification.href like '/painel/trocas/%'
  );

delete from public.notifications notification
using (
  select id, row_number() over (
    partition by user_id, kind, href
    order by created_at desc, id desc
  ) duplicate_number
  from public.notifications
  where href is not null
) duplicates
where notification.id = duplicates.id and duplicates.duplicate_number > 1;
