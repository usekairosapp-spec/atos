create or replace function public.platform_review_church_membership(
  target_membership_id uuid,
  decision public.membership_status
)
returns void language plpgsql security definer set search_path = ''
as $$
declare target_role public.church_role; target_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas a administradora geral pode revisar por esta Central.';
  end if;
  if decision not in ('active', 'rejected') then raise exception 'Decisão inválida.'; end if;

  select role, user_id into target_role, target_user_id
  from public.church_memberships
  where id = target_membership_id and status = 'pending'
  for update;
  if target_user_id is null then raise exception 'Solicitação não encontrada ou já analisada.'; end if;
  if target_role = 'church_admin' or exists (select 1 from public.platform_roles where user_id = target_user_id) then
    raise exception 'Administradores não podem ser alterados por este fluxo.';
  end if;

  update public.church_memberships set status = decision, updated_at = now()
  where id = target_membership_id and status = 'pending';
end;
$$;
revoke all on function public.platform_review_church_membership(uuid, public.membership_status) from public;
grant execute on function public.platform_review_church_membership(uuid, public.membership_status) to authenticated;

create or replace function public.notify_membership_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare member_name text; church_name text;
begin
  select full_name into member_name from public.profiles where id = new.user_id;
  select name into church_name from public.churches where id = new.church_id;
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select cm.user_id, new.church_id, 'Nova solicitação de membro', coalesce(nullif(member_name, ''), 'Uma pessoa') || ' pediu para entrar na igreja.', 'membership_requested', '/painel/membros', 'membership:' || new.id || ':request:' || extract(epoch from new.updated_at)::text
    from public.church_memberships cm
    where cm.church_id = new.church_id and cm.role = 'church_admin' and cm.status = 'active' and cm.user_id <> new.user_id
    on conflict (user_id, event_key) do nothing;
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    select pr.user_id, new.church_id, 'Solicitação em ' || coalesce(church_name, 'uma igreja'), coalesce(nullif(member_name, ''), 'Uma pessoa') || ' está aguardando aprovação.', 'membership_requested', '/central/solicitacoes', 'platform:membership:' || new.id || ':request:' || extract(epoch from new.updated_at)::text
    from public.platform_roles pr on conflict (user_id, event_key) do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status in ('active', 'rejected') then
    insert into public.notifications (user_id, church_id, title, body, kind, href, event_key)
    values (new.user_id, new.church_id,
      case when new.status = 'active' then 'Entrada aprovada' else 'Solicitação recusada' end,
      case when new.status = 'active' then 'Sua entrada na igreja foi aprovada.' else 'Sua solicitação de entrada não foi aprovada.' end,
      case when new.status = 'active' then 'membership_approved' else 'membership_rejected' end,
      '/painel', 'membership:' || new.id || ':' || new.status::text)
    on conflict (user_id, event_key) do nothing;
  end if;
  return new;
end;
$$;

update public.notifications
set href = '/central/solicitacoes'
where kind = 'membership_requested' and event_key like 'platform:membership:%';

