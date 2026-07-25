create or replace function public.get_sector_swap_candidates(target_schedule_id uuid, target_assignment_id uuid)
returns table (candidate_user_id uuid, candidate_name text, candidate_avatar_path text, candidate_roles text[])
language sql stable security definer set search_path = ''
as $$
  with requester_schedule as (
    select ds.department_id
    from public.schedule_assignments sa
    join public.department_schedules ds on ds.id = sa.department_schedule_id
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
  group by dm.user_id, p.full_name, p.avatar_path
  order by p.full_name;
$$;

revoke all on function public.get_sector_swap_candidates(uuid, uuid) from public;
grant execute on function public.get_sector_swap_candidates(uuid, uuid) to authenticated;
