create or replace function public.delete_church_permanently(target_church_id uuid, expected_church_name text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare actual_name text;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas a administradora da plataforma pode excluir igrejas.';
  end if;

  select name into actual_name
  from public.churches
  where id = target_church_id
  for update;

  if actual_name is null then raise exception 'Igreja não encontrada.'; end if;
  if expected_church_name is distinct from actual_name then
    raise exception 'O nome de confirmação não corresponde ao nome da igreja.';
  end if;

  delete from public.churches where id = target_church_id;
  return actual_name;
end;
$$;

revoke all on function public.delete_church_permanently(uuid, text) from public;
grant execute on function public.delete_church_permanently(uuid, text) to authenticated;

