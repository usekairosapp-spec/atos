-- A lista de pessoas pra trocar mostrava todo mundo do setor, mesmo quem já
-- estava nessa mesma escala ou já tinha outro compromisso no mesmo horário
-- (o que só dava erro depois, ao confirmar a troca). Agora a lista já sai
-- filtrada só com quem está de fato disponível naquele dia/horário — mesma
-- regra que request_assignment_swap já validava no envio.
create or replace function public.get_sector_swap_candidates(target_schedule_id uuid, target_assignment_id uuid)
returns table (candidate_user_id uuid, candidate_name text, candidate_avatar_path text, candidate_roles text[])
language sql
stable
security definer
set search_path = ''
as $$
  with requester_schedule as (
    select ds.department_id, s.starts_at as event_start, s.ends_at as event_end
    from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
    join public.services s on s.id = ds.service_id
    where sa.id = target_assignment_id
      and sa.department_schedule_id = target_schedule_id
      and sa.user_id = (select auth.uid())
      and sa.status in ('pending', 'confirmed')
      and ds.status = 'published'
  )
  select dm.user_id, p.full_name, p.avatar_path,
    coalesce(array_agg(distinct pos.name) filter (where pos.name is not null), '{}'::text[])
  from requester_schedule rs
  join public.department_memberships dm on dm.department_id = rs.department_id and dm.status = 'active'
  join public.profiles p on p.id = dm.user_id
  left join public.member_positions mp on mp.user_id = dm.user_id
  left join public.positions pos on pos.id = mp.position_id and pos.department_id = rs.department_id and pos.active
  where dm.user_id <> (select auth.uid())
    -- ja esta nesta mesma escala
    and not exists (
      select 1 from public.schedule_assignments existing
      where existing.department_schedule_id = target_schedule_id
        and existing.user_id = dm.user_id
    )
    -- tem outro compromisso publicado que colide com o horario deste culto
    and not exists (
      select 1
      from public.schedule_assignments other_sa
      join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
      join public.services other_s on other_s.id = other_ds.service_id
      where other_sa.user_id = dm.user_id
        and other_ds.status = 'published'
        and other_sa.status in ('pending', 'confirmed', 'replacement_requested')
        and other_s.starts_at < rs.event_end
        and other_s.ends_at > rs.event_start
    )
  group by dm.user_id, p.full_name, p.avatar_path
  order by p.full_name;
$$;
