create or replace function public.assign_department_memberships(
  target_department_ids uuid[],
  target_user_id uuid,
  target_role public.department_role
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  target_department_id uuid;
  target_church_id uuid;
  expected_church_id uuid;
  assigned_count integer := 0;
begin
  if target_department_ids is null or cardinality(target_department_ids) = 0 then
    raise exception 'Selecione pelo menos uma equipe.';
  end if;

  foreach target_department_id in array target_department_ids loop
    select church_id into target_church_id
    from public.departments
    where id = target_department_id and active;

    if target_church_id is null then
      raise exception 'Uma das equipes não foi encontrada.';
    end if;
    if expected_church_id is null then
      expected_church_id := target_church_id;
    elsif expected_church_id <> target_church_id then
      raise exception 'As equipes selecionadas precisam pertencer à mesma igreja.';
    end if;
    if not public.is_church_admin(target_church_id) then
      raise exception 'Sem permissão para atribuir uma das equipes.';
    end if;
    if not exists (
      select 1 from public.church_memberships
      where church_id = target_church_id
        and user_id = target_user_id
        and status = 'active'
    ) then
      raise exception 'A pessoa não é membro ativo desta igreja.';
    end if;

    insert into public.department_memberships (department_id, user_id, role, status)
    values (target_department_id, target_user_id, target_role, 'active')
    on conflict (department_id, user_id) do update
      set role = excluded.role, status = 'active', updated_at = now();
    assigned_count := assigned_count + 1;
  end loop;

  return assigned_count;
end;
$$;

revoke all on function public.assign_department_memberships(uuid[], uuid, public.department_role) from public;
grant execute on function public.assign_department_memberships(uuid[], uuid, public.department_role) to authenticated;
