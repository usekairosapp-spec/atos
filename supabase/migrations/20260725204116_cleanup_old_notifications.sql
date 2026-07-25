-- Deleta notificações que já foram marcadas como lidas
DELETE FROM public.notifications WHERE read_at IS NOT NULL;
