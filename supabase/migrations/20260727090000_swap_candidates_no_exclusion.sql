-- Achado no teste real: quem ja estava na mesma escala (em outra funcao)
-- sumia da lista de candidatos em vez de aparecer com aviso — a exclusao
-- era uma restricao artificial, ja que a tabela permite a mesma pessoa em
-- mais de uma funcao na mesma escala (unique key inclui position_id).
-- Agora ninguem e excluido: quem ja esta nesta escala, ou tem outro
-- compromisso no mesmo horario, so ganha o aviso — o lider decide.
create or replace function public.get_department_swap_candidates_for_leader(target_assignment_id uuid)
returns table (candidate_user_id uuid, candidate_name text, has_conflict boolean, conflict_label text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_department_id uuid;
  target_schedule_id uuid;
  event_start timestamptz;
  event_end timestamptz;
begin
  select ds.department_id, ds.id, s.starts_at, s.ends_at
  into target_department_id, target_schedule_id, event_start, event_end
  from public.schedule_assignments sa
  join public.department_schedules ds on ds.id = sa.department_schedule_id
  join public.services s on s.id = ds.service_id
  where sa.id = target_assignment_id;

  if target_department_id is null or not public.is_assigned_department_leader(target_department_id) then
    raise exception 'Apenas o líder atribuído pode trocar pessoas nesta escala.';
  end if;

  return query
  select
    dm.user_id,
    p.full_name,
    (
      exists (select 1 from public.schedule_assignments same where same.department_schedule_id = target_schedule_id and same.user_id = dm.user_id)
      or exists (
        select 1
        from public.schedule_assignments other_sa
        join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
        join public.services other_s on other_s.id = other_ds.service_id
        where other_sa.user_id = dm.user_id
          and other_ds.status = 'published'
          and other_sa.status in ('pending', 'confirmed', 'replacement_requested')
          and other_s.starts_at < event_end
          and other_s.ends_at > event_start
      )
    ),
    coalesce(
      (select 'já está nesta mesma escala' from public.schedule_assignments same where same.department_schedule_id = target_schedule_id and same.user_id = dm.user_id limit 1),
      (
        select d2.name || ', ' || to_char(other_s.starts_at at time zone 'America/Sao_Paulo', 'DD/MM')
        from public.schedule_assignments other_sa
        join public.department_schedules other_ds on other_ds.id = other_sa.department_schedule_id
        join public.departments d2 on d2.id = other_ds.department_id
        join public.services other_s on other_s.id = other_ds.service_id
        where other_sa.user_id = dm.user_id
          and other_ds.status = 'published'
          and other_sa.status in ('pending', 'confirmed', 'replacement_requested')
          and other_s.starts_at < event_end
          and other_s.ends_at > event_start
        limit 1
      )
    )
  from public.department_memberships dm
  join public.profiles p on p.id = dm.user_id
  where dm.department_id = target_department_id
    and dm.status = 'active'
  order by p.full_name;
end;
$$;
