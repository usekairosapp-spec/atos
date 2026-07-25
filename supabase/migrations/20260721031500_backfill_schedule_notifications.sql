insert into public.notifications (user_id, church_id, title, body, kind, href, created_at)
select sa.user_id, d.church_id, 'Nova escala publicada', 'Você foi escalado(a) para ' || s.title || '.',
  'schedule_published', '/painel/escalas/' || ds.id, coalesce(ds.published_at, ds.created_at)
from public.schedule_assignments sa
join public.department_schedules ds on ds.id = sa.department_schedule_id
join public.departments d on d.id = ds.department_id
join public.services s on s.id = ds.service_id
where ds.status = 'published'
  and not exists (
    select 1 from public.notifications n
    where n.user_id = sa.user_id and n.href = '/painel/escalas/' || ds.id
      and n.kind in ('schedule_published', 'schedule_added')
  );
