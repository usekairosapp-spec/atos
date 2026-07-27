-- Permite ao administrador da plataforma editar o nome da igreja a partir
-- do painel central (/central/igrejas/[churchId]). Renomear e restrito ao
-- platform admin (nao ao admin da propria igreja), diferente das cores/logo
-- que ja podiam ser alteradas por ambos.
drop function if exists public.update_church_branding(uuid, text, text, text, text);

create or replace function public.update_church_branding(
  target_church_id uuid,
  target_primary_color text,
  target_logo_path text default null,
  target_cover_path text default null,
  target_secondary_color text default null,
  target_name text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_church_admin(target_church_id) or public.is_platform_admin()) then
    raise exception 'Sem permissão para alterar a identidade visual.';
  end if;
  if target_primary_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida.'; end if;
  if target_secondary_color is not null and target_secondary_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor de texto inválida.'; end if;
  if target_name is not null then
    if not public.is_platform_admin() then
      raise exception 'Apenas o administrador da plataforma pode renomear a igreja.';
    end if;
    if char_length(trim(target_name)) < 2 or char_length(trim(target_name)) > 120 then
      raise exception 'O nome da igreja deve ter entre 2 e 120 caracteres.';
    end if;
  end if;
  update public.churches
  set name = coalesce(nullif(trim(target_name), ''), name),
      primary_color = lower(target_primary_color),
      secondary_color = coalesce(lower(target_secondary_color), secondary_color),
      logo_path = coalesce(target_logo_path, logo_path),
      cover_path = coalesce(target_cover_path, cover_path),
      updated_at = now()
  where id = target_church_id and status = 'active';
  if not found then raise exception 'Igreja não encontrada.'; end if;
end;
$$;

revoke all on function public.update_church_branding(uuid, text, text, text, text, text) from public;
grant execute on function public.update_church_branding(uuid, text, text, text, text, text) to authenticated;
