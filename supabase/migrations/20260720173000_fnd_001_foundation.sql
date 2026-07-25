begin;

create extension if not exists pgcrypto;

create type public.church_status as enum ('active', 'suspended', 'archived');
create type public.membership_status as enum ('pending', 'active', 'suspended', 'rejected');
create type public.church_role as enum ('church_admin', 'member');
create type public.department_role as enum ('leader', 'member');
create type public.platform_role as enum ('platform_admin');
create type public.department_type as enum ('technical', 'media', 'officers', 'worship', 'reception', 'kids', 'custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_path text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'America/Sao_Paulo',
  logo_path text,
  status public.church_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role public.platform_role not null default 'platform_admin',
  created_at timestamptz not null default now()
);

create table public.church_memberships (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.church_role not null default 'member',
  status public.membership_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, user_id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  type public.department_type not null,
  name text not null check (char_length(name) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (church_id, name)
);

create table public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.department_role not null default 'member',
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, user_id)
);

create index church_memberships_user_idx on public.church_memberships(user_id, status);
create index church_memberships_church_idx on public.church_memberships(church_id, status);
create index departments_church_idx on public.departments(church_id, active);
create index department_memberships_user_idx on public.department_memberships(user_id, status);
create index department_memberships_department_idx on public.department_memberships(department_id, status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.seed_default_departments()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.departments (church_id, type, name) values
    (new.id, 'technical', 'Técnica'),
    (new.id, 'media', 'Mídia'),
    (new.id, 'officers', 'Oficiais'),
    (new.id, 'worship', 'Louvor'),
    (new.id, 'reception', 'Recepção'),
    (new.id, 'kids', 'Kids');
  return new;
end;
$$;

create trigger on_church_created_seed_departments
  after insert on public.churches
  for each row execute procedure public.seed_default_departments();

create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.platform_roles
    where user_id = (select auth.uid()) and role = 'platform_admin'
  );
$$;

create or replace function public.is_active_church_member(target_church_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.church_memberships
    where church_id = target_church_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.is_church_admin(target_church_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.church_memberships
    where church_id = target_church_id
      and user_id = (select auth.uid())
      and role = 'church_admin'
      and status = 'active'
  );
$$;

create or replace function public.is_department_leader(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_church_admin(d.church_id) or exists (
    select 1 from public.department_memberships dm
    where dm.department_id = target_department_id
      and dm.user_id = (select auth.uid())
      and dm.role = 'leader'
      and dm.status = 'active'
  )
  from public.departments d where d.id = target_department_id;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_active_church_member(uuid) from public;
revoke all on function public.is_church_admin(uuid) from public;
revoke all on function public.is_department_leader(uuid) from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_active_church_member(uuid) to authenticated;
grant execute on function public.is_church_admin(uuid) to authenticated;
grant execute on function public.is_department_leader(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.churches enable row level security;
alter table public.platform_roles enable row level security;
alter table public.church_memberships enable row level security;
alter table public.departments enable row level security;
alter table public.department_memberships enable row level security;

create policy "profiles read self or same church" on public.profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1
    from public.church_memberships mine
    join public.church_memberships theirs on theirs.church_id = mine.church_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and theirs.user_id = profiles.id and theirs.status = 'active'
  )
);
create policy "profiles update self" on public.profiles
for update to authenticated using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "churches read by members" on public.churches
for select to authenticated using (public.is_active_church_member(id) or public.is_platform_admin());
create policy "churches managed by platform admin" on public.churches
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "platform roles read self" on public.platform_roles
for select to authenticated using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "platform roles managed by platform admin" on public.platform_roles
for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "memberships read self or church admin" on public.church_memberships
for select to authenticated using (
  user_id = (select auth.uid()) or public.is_church_admin(church_id)
);
create policy "memberships managed by church admin" on public.church_memberships
for all to authenticated using (public.is_church_admin(church_id))
with check (public.is_church_admin(church_id));

create policy "departments read by church members" on public.departments
for select to authenticated using (public.is_active_church_member(church_id) or public.is_platform_admin());
create policy "departments managed by church admin" on public.departments
for all to authenticated using (public.is_church_admin(church_id))
with check (public.is_church_admin(church_id));

create policy "department memberships read in church" on public.department_memberships
for select to authenticated using (
  exists (
    select 1 from public.departments d
    where d.id = department_id and public.is_active_church_member(d.church_id)
  ) or public.is_platform_admin()
);
create policy "department memberships managed by leaders" on public.department_memberships
for all to authenticated using (public.is_department_leader(department_id))
with check (public.is_department_leader(department_id));

commit;
