-- RPC para remover membro de departamento (contorna RLS)
create or replace function public.remove_department_member(target_department_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  church_id_var uuid;
begin
  -- Verifica se o usuário é admin da igreja
  select d.church_id into church_id_var from public.departments d where d.id = target_department_id;

  if not public.is_church_admin(church_id_var) then
    raise exception 'Sem permissão para remover membros deste departamento.';
  end if;

  -- Remove o membro
  delete from public.department_memberships
  where department_id = target_department_id and user_id = target_user_id;
end;
$$;
