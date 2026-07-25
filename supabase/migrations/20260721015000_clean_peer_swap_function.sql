create or replace function public.respond_to_peer_swap(target_request_id uuid, accept_request boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare target_assignment_id uuid; recipient_id uuid;
begin
  select assignment_id, suggested_user_id into target_assignment_id, recipient_id
  from public.swap_requests where id = target_request_id and status = 'pending';
  if target_assignment_id is null or recipient_id <> (select auth.uid()) then
    raise exception 'Convite de troca não encontrado ou sem permissão.';
  end if;
  if accept_request then
    update public.schedule_assignments set user_id = recipient_id, status = 'confirmed', responded_at = now(), updated_at = now()
    where id = target_assignment_id;
    update public.swap_requests set status = 'accepted', updated_at = now() where id = target_request_id;
  else
    update public.schedule_assignments set status = 'confirmed', responded_at = now(), updated_at = now()
    where id = target_assignment_id;
    update public.swap_requests set status = 'rejected', updated_at = now() where id = target_request_id;
  end if;
end;
$$;
