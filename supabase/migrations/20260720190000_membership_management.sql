alter table public.churches
add column invite_code text not null default upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

create unique index churches_invite_code_idx on public.churches(invite_code);

drop policy "profiles read self or same church" on public.profiles;
create policy "profiles read self or church colleagues" on public.profiles
for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1
    from public.church_memberships theirs
    where theirs.user_id = profiles.id
      and (
        public.is_church_admin(theirs.church_id)
        or exists (
          select 1 from public.church_memberships mine
          where mine.church_id = theirs.church_id
            and mine.user_id = (select auth.uid())
            and mine.status = 'active'
            and theirs.status = 'active'
        )
      )
  )
);

create or replace function public.request_church_membership(code text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  target_church_id uuid;
  membership_id uuid;
begin
  select id into target_church_id
  from public.churches
  where invite_code = upper(trim(code)) and status = 'active';

  if target_church_id is null then
    raise exception 'Código de igreja inválido.';
  end if;

  insert into public.church_memberships (church_id, user_id, role, status)
  values (target_church_id, (select auth.uid()), 'member', 'pending')
  on conflict (church_id, user_id) do update
    set status = case
      when public.church_memberships.status = 'rejected' then 'pending'
      else public.church_memberships.status
    end,
    updated_at = now()
  returning id into membership_id;

  return membership_id;
end;
$$;

create or replace function public.review_church_membership(
  target_membership_id uuid,
  decision public.membership_status
)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  target_church_id uuid;
begin
  select church_id into target_church_id
  from public.church_memberships where id = target_membership_id;

  if target_church_id is null or not public.is_church_admin(target_church_id) then
    raise exception 'Sem permissão para revisar este membro.';
  end if;
  if decision not in ('active', 'rejected', 'suspended') then
    raise exception 'Decisão inválida.';
  end if;

  update public.church_memberships
  set status = decision, updated_at = now()
  where id = target_membership_id;
end;
$$;

revoke all on function public.request_church_membership(text) from public;
revoke all on function public.review_church_membership(uuid, public.membership_status) from public;
grant execute on function public.request_church_membership(text) to authenticated;
grant execute on function public.review_church_membership(uuid, public.membership_status) to authenticated;
