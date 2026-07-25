create table public.positions (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  default_slots integer not null default 1 check (default_slots between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, name)
);

create table public.member_positions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  position_id uuid not null references public.positions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, position_id)
);

create index positions_department_idx on public.positions(department_id, active);
create index member_positions_position_idx on public.member_positions(position_id);

create or replace function public.seed_department_positions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.type = 'technical' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Holyrics', 1), (new.id, 'Telão', 1), (new.id, 'Transmissão', 1),
      (new.id, 'Som', 1), (new.id, 'Câmeras', 3);
  elsif new.type = 'media' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Storymaker', 1), (new.id, 'Copy', 1), (new.id, 'Fotografia', 1);
  elsif new.type = 'worship' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Ministro', 1), (new.id, 'Guitarrista', 1), (new.id, 'Baixista', 1),
      (new.id, 'Tecladista', 1), (new.id, 'Baterista', 1);
  elsif new.type = 'kids' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Professora', 1), (new.id, 'Auxiliar', 1);
  elsif new.type = 'reception' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Recepcionista', 1);
  elsif new.type = 'officers' then
    insert into public.positions (department_id, name, default_slots) values
      (new.id, 'Responsável da frente', 1), (new.id, 'Estacionamento', 1),
      (new.id, 'Auxiliar de culto', 1);
  end if;
  return new;
end;
$$;

create trigger on_department_created_seed_positions
  after insert on public.departments
  for each row execute procedure public.seed_department_positions();

insert into public.positions (department_id, name, default_slots)
select d.id, seed.name, seed.default_slots
from public.departments d
cross join lateral (
  select * from (values
    ('technical'::public.department_type, 'Holyrics', 1),
    ('technical', 'Telão', 1), ('technical', 'Transmissão', 1), ('technical', 'Som', 1), ('technical', 'Câmeras', 3),
    ('media', 'Storymaker', 1), ('media', 'Copy', 1), ('media', 'Fotografia', 1),
    ('worship', 'Ministro', 1), ('worship', 'Guitarrista', 1), ('worship', 'Baixista', 1), ('worship', 'Tecladista', 1), ('worship', 'Baterista', 1),
    ('kids', 'Professora', 1), ('kids', 'Auxiliar', 1),
    ('reception', 'Recepcionista', 1),
    ('officers', 'Responsável da frente', 1), ('officers', 'Estacionamento', 1), ('officers', 'Auxiliar de culto', 1)
  ) as values_list(type, name, default_slots)
  where values_list.type = d.type
) seed
on conflict (department_id, name) do nothing;

alter table public.positions enable row level security;
alter table public.member_positions enable row level security;

create policy "positions read by church members" on public.positions
for select to authenticated using (
  exists (
    select 1 from public.departments d
    where d.id = department_id
      and (public.is_active_church_member(d.church_id) or public.is_platform_admin())
  )
);

create policy "positions managed by church admins" on public.positions
for all to authenticated using (
  exists (select 1 from public.departments d where d.id = department_id and public.is_church_admin(d.church_id))
)
with check (
  exists (select 1 from public.departments d where d.id = department_id and public.is_church_admin(d.church_id))
);

create policy "member positions read in authorized departments" on public.member_positions
for select to authenticated using (
  user_id = (select auth.uid()) or exists (
    select 1 from public.positions p where p.id = position_id and public.is_department_leader(p.department_id)
  )
);

create policy "member positions managed by department leaders" on public.member_positions
for all to authenticated using (
  exists (select 1 from public.positions p where p.id = position_id and public.is_department_leader(p.department_id))
)
with check (
  exists (select 1 from public.positions p where p.id = position_id and public.is_department_leader(p.department_id))
);
