drop policy if exists "authorized admins insert branding" on storage.objects;
drop policy if exists "authorized admins update branding" on storage.objects;
drop policy if exists "authorized admins delete branding" on storage.objects;

create policy "authorized admins insert branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'church-branding'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (
    public.is_platform_admin()
    or public.is_church_admin(((storage.foldername(name))[1])::uuid)
  )
);

create policy "authorized admins update branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'church-branding'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (public.is_platform_admin() or public.is_church_admin(((storage.foldername(name))[1])::uuid))
)
with check (
  bucket_id = 'church-branding'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (public.is_platform_admin() or public.is_church_admin(((storage.foldername(name))[1])::uuid))
);

create policy "authorized admins delete branding"
on storage.objects for delete to authenticated
using (
  bucket_id = 'church-branding'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and (public.is_platform_admin() or public.is_church_admin(((storage.foldername(name))[1])::uuid))
);

