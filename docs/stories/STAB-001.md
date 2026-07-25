# Story STAB-001 — Estabilização de segurança, membros, agenda e performance

## Status

Ready for Review

## História

Como administradora de uma igreja, líder ou membro, quero que os fluxos críticos preservem permissões, consistência e desempenho, para usar o AppEscala com segurança inclusive quando houver sincronização com serviços externos.

## Critérios de aceite

### Membros e permissões

- [x] Administradora da igreja remove ou suspende com segurança um membro da própria igreja.
- [x] A remoção encerra vínculos de setor incompatíveis sem afetar outras igrejas do usuário.
- [x] Líder não promove outro líder nem executa ações fora dos setores atribuídos.
- [x] Admin que também é líder mantém as capacidades dos dois papéis no contexto correto.
- [x] Operações sensíveis são autorizadas no banco por RPC/RLS, não apenas ocultadas na interface.

### Google Agenda

- [x] Sincronizar uma escala com evento existente envia os dados atuais por `PATCH`.
- [x] Duplo clique ou requisições concorrentes não criam dois eventos para a mesma participação.
- [x] Criação e atualização do vínculo local ocorrem somente por RPC validada; escrita direta autenticada é bloqueada.
- [x] O retorno preserva a tela de origem informada (`returnTo`) ou usa o detalhe como fallback seguro.
- [x] Remoção de participação e troca direta removem o vínculo local obsoleto e enfileiram a exclusão externa.
- [x] Pendências externas do próprio usuário são processadas quando ele volta a sincronizar com token Google válido.
- [x] O fluxo de conexão não usa fallback capaz de trocar silenciosamente a conta AppEscala autenticada.
- [ ] Exclusão remota imediata é validada em ambiente integrado; sem token do dono, a limpeza permanece assíncrona e rastreável.

### Calendário e performance

- [x] Calendário pessoal retorna somente participações ativas, publicadas, da igreja e mês selecionados.
- [x] Navegação entre dezembro/janeiro gera ano e mês válidos.
- [x] Consultas de calendário e listagens usam filtros/índices adequados e não carregam dados de outros tenants.
- [x] A tela principal do calendário evita consultas redundantes e elimina waterfalls identificados na auditoria.

### Qualidade e segurança

- [x] Há testes de regressão para autorização, remoção de membro, hardening Google e navegação anual.
- [x] Migrações aplicam sem erro no banco remoto com as migrações anteriores.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam.
- [x] Segredos/tokens Google não são persistidos em tabelas públicas nem enviados ao cliente.

## Tarefas

- [x] Criar hardening de tabelas/RPCs da integração Google.
- [x] Implementar lease transacional para serializar sincronizações por participação.
- [x] Atualizar evento existente e recriar somente quando ele não existir mais no Google.
- [x] Criar fila de limpeza para remoção e transferência de participações.
- [x] Preservar retorno seguro e impedir fallback OAuth que troque silenciosamente o usuário.
- [x] Estabilizar remoção de membro pela administradora.
- [x] Corrigir navegação anual e fallback do calendário pessoal.
- [x] Adicionar testes de regressão e executar todos os quality gates.

## Limitações conhecidas

- A API do Google exige token do proprietário do calendário. Quando líder/admin remove ou transfere uma participação, o backend não possui esse token; por isso a exclusão externa é enfileirada e processada na próxima sincronização autenticada do proprietário.
- O AppEscala não armazena refresh token Google. Autorização expirada exige reconexão explícita e segura.

## File List

- `docs/stories/STAB-001.md`
- `supabase/migrations/20260722023000_google_calendar_hardening.sql`
- `src/features/calendar/actions.ts`
- `supabase/migrations/20260722021500_security_member_removal.sql`
- `src/features/members/actions.ts`
- `src/features/members/security-member-removal.test.ts`
- `src/features/calendar/calendar-hardening.test.ts`
- `src/app/painel/membros/page.tsx`
- `src/app/painel/calendario/page.tsx`
- `src/app/painel/loading.tsx`
- `src/app/painel/page.tsx`
- `src/app/painel/escalas/[scheduleId]/page.tsx`
- `src/app/painel/notificacoes/[notificationId]/abrir/route.ts`
- `src/shared/components/pending-submit-button.tsx`
- `src/shared/components/confirm-submit-button.tsx`
