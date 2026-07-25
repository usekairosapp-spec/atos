create or replace function public.is_assigned_department_leader(target_department_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.department_memberships
    where department_id = target_department_id
      and user_id = (select auth.uid())
      and role = 'leader'
      and status = 'active'
  );
$$;

revoke all on function public.is_assigned_department_leader(uuid) from public;
grant execute on function public.is_assigned_department_leader(uuid) to authenticated;

drop policy "positions managed by church admins" on public.positions;
create policy "positions managed by assigned department leaders" on public.positions
for all to authenticated
using (public.is_assigned_department_leader(department_id))
with check (public.is_assigned_department_leader(department_id));

create or replace function public.seed_department_positions()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.type = 'technical' then
    insert into public.positions (department_id, name) values
      (new.id, 'Holyrics'), (new.id, 'Telão'), (new.id, 'Transmissão'),
      (new.id, 'Som'), (new.id, 'Câmeras');
  elsif new.type = 'media' then
    insert into public.positions (department_id, name) values
      (new.id, 'Storymaker'), (new.id, 'Copy'), (new.id, 'Fotografia');
  elsif new.type = 'worship' then
    insert into public.positions (department_id, name) values
      (new.id, 'Ministro'), (new.id, 'Guitarrista'), (new.id, 'Baixista'),
      (new.id, 'Tecladista'), (new.id, 'Baterista');
  elsif new.type = 'kids' then
    insert into public.positions (department_id, name) values
      (new.id, 'Professora'), (new.id, 'Auxiliar');
  elsif new.type = 'reception' then
    insert into public.positions (department_id, name) values (new.id, 'Recepcionista');
  elsif new.type = 'officers' then
    insert into public.positions (department_id, name) values
      (new.id, 'Responsável da frente'), (new.id, 'Estacionamento'),
      (new.id, 'Auxiliar de culto');
  end if;
  return new;
end;
$$;

alter table public.positions drop column default_slots;
