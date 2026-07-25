drop policy if exists "church admins insert branding" on storage.objects;
drop policy if exists "church admins update branding" on storage.objects;
drop policy if exists "church admins delete branding" on storage.objects;

create policy "authorized admins insert branding" on storage.objects for insert to authenticated
with check (bucket_id = 'church-branding' and exists (
  select 1 from public.churches c
  where c.id::text = (storage.foldername(name))[1]
    and (public.is_church_admin(c.id) or public.is_platform_admin())
));
create policy "authorized admins update branding" on storage.objects for update to authenticated
using (bucket_id = 'church-branding' and exists (
  select 1 from public.churches c
  where c.id::text = (storage.foldername(name))[1]
    and (public.is_church_admin(c.id) or public.is_platform_admin())
))
with check (bucket_id = 'church-branding' and exists (
  select 1 from public.churches c
  where c.id::text = (storage.foldername(name))[1]
    and (public.is_church_admin(c.id) or public.is_platform_admin())
));
create policy "authorized admins delete branding" on storage.objects for delete to authenticated
using (bucket_id = 'church-branding' and exists (
  select 1 from public.churches c
  where c.id::text = (storage.foldername(name))[1]
    and (public.is_church_admin(c.id) or public.is_platform_admin())
));

create or replace function public.update_church_branding(target_church_id uuid, target_primary_color text, target_logo_path text default null, target_cover_path text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not (public.is_church_admin(target_church_id) or public.is_platform_admin()) then
    raise exception 'Sem permissão para alterar a identidade visual.';
  end if;
  if target_primary_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida.'; end if;
  update public.churches
  set primary_color = lower(target_primary_color),
      logo_path = coalesce(target_logo_path, logo_path),
      cover_path = coalesce(target_cover_path, cover_path),
      updated_at = now()
  where id = target_church_id and status = 'active';
  if not found then raise exception 'Igreja não encontrada.'; end if;
end;
$$;

