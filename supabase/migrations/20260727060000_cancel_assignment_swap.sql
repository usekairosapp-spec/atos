-- Permite que quem solicitou uma troca a cancele antes da outra pessoa
-- responder, devolvendo a escala pro status que tinha antes do pedido.
-- O status 'cancelled' ja era aceito pela constraint de swap_requests mas
-- nunca tinha uma funcao que o usasse.
create or replace function public.cancel_assignment_swap(target_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_assignment_id uuid;
  requester_id uuid;
  prior_status public.assignment_status;
begin
  select sr.assignment_id, sr.requested_by, sr.previous_assignment_status
  into target_assignment_id, requester_id, prior_status
  from public.swap_requests sr
  where sr.id = target_request_id and sr.status = 'pending'
  for update of sr;

  if target_assignment_id is null or requester_id <> (select auth.uid()) then
    raise exception 'Solicitação de troca não encontrada ou sem permissão.';
  end if;

  update public.schedule_assignments
  set status = prior_status,
      responded_at = case when prior_status = 'confirmed' then now() else null end,
      updated_at = now()
  where id = target_assignment_id and status = 'replacement_requested';
  if not found then
    raise exception 'A participação mudou enquanto a troca era processada.';
  end if;

  update public.swap_requests
  set status = 'cancelled', updated_at = now()
  where id = target_request_id and status = 'pending';
end;
$$;

revoke all on function public.cancel_assignment_swap(uuid) from public;
grant execute on function public.cancel_assignment_swap(uuid) to authenticated;
