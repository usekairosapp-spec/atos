-- Remove RLS policy antiga e cria nova que permite admins
drop policy if exists "department memberships managed by leaders or church admins" on public.department_memberships;

create policy "department memberships managed by leaders or church admins" on public.department_memberships
for all to authenticated using (
  public.is_department_leader(department_id) or
  public.is_church_admin((select church_id from public.departments where id = department_id))
)
with check (
  public.is_department_leader(department_id) or
  public.is_church_admin((select church_id from public.departments where id = department_id))
);

-- RPC que funciona com security definer (contorna RLS)
create or replace function public.remove_department_member(target_department_id uuid, target_user_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  church_id_var uuid;
  deleted_count int;
begin
  select church_id into church_id_var
  from departments
  where id = target_department_id;

  if church_id_var is null then
    return json_build_object('success', false, 'error', 'Departamento não encontrado');
  end if;

  if not public.is_church_admin(church_id_var) then
    return json_build_object('success', false, 'error', 'Sem permissão para remover membros');
  end if;

  delete from department_memberships
  where department_id = target_department_id
    and user_id = target_user_id;

  get diagnostics deleted_count = row_count;

  return json_build_object(
    'success', true,
    'deleted', deleted_count,
    'message', deleted_count || ' membro(s) removido(s)'
  );
end;
$$;

grant execute on function public.remove_department_member(uuid, uuid) to authenticated;
