alter table public.churches
add column if not exists cover_path text,
add column if not exists primary_color text not null default '#6d35d7';

alter table public.churches drop constraint if exists churches_primary_color_check;
alter table public.churches add constraint churches_primary_color_check
check (primary_color ~ '^#[0-9A-Fa-f]{6}$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('church-branding', 'church-branding', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "church branding public read" on storage.objects for select to public
using (bucket_id = 'church-branding');
create policy "church admins insert branding" on storage.objects for insert to authenticated
with check (bucket_id = 'church-branding' and exists (select 1 from public.churches c where c.id::text = (storage.foldername(name))[1] and public.is_church_admin(c.id)));
create policy "church admins update branding" on storage.objects for update to authenticated
using (bucket_id = 'church-branding' and exists (select 1 from public.churches c where c.id::text = (storage.foldername(name))[1] and public.is_church_admin(c.id)))
with check (bucket_id = 'church-branding' and exists (select 1 from public.churches c where c.id::text = (storage.foldername(name))[1] and public.is_church_admin(c.id)));
create policy "church admins delete branding" on storage.objects for delete to authenticated
using (bucket_id = 'church-branding' and exists (select 1 from public.churches c where c.id::text = (storage.foldername(name))[1] and public.is_church_admin(c.id)));

create or replace function public.update_church_branding(target_church_id uuid, target_primary_color text, target_logo_path text default null, target_cover_path text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_church_admin(target_church_id) then raise exception 'Apenas a administradora da igreja pode alterar a identidade visual.'; end if;
  if target_primary_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Cor inválida.'; end if;
  update public.churches set primary_color = lower(target_primary_color), logo_path = coalesce(target_logo_path, logo_path), cover_path = coalesce(target_cover_path, cover_path), updated_at = now() where id = target_church_id and status = 'active';
  if not found then raise exception 'Igreja não encontrada.'; end if;
end;
$$;

revoke all on function public.update_church_branding(uuid, text, text, text) from public;
grant execute on function public.update_church_branding(uuid, text, text, text) to authenticated;

