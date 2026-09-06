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


## Dev Agent Record — calendário com equipe do dia

Solicitação: opção 2 da prévia aprovada; tocar no dia abre uma janela com os participantes e suas funções nas escalas visíveis no calendário pessoal.

- [x] Abrir janela inferior no celular e centralizada no desktop, com fechamento por botão, fundo e Escape.
- [x] Mostrar equipes por culto/setor, agregando funções da mesma pessoa e tratando dia vazio/falha de consulta.
- [x] Preservar acesso às escalas, sincronização Google e permissões RPC existentes.
- [x] Executar testes, lint, typecheck e build.

### File List desta alteração

- `src/app/painel/calendario/page.tsx`
- `src/features/calendar/components/calendar-day-dialog.tsx`
- `src/features/calendar/components/calendar-day-dialog.test.tsx`
- `docs/stories/STAB-001.md`

### Validação

- 21 testes passaram, incluindo 4 testes de interação da janela (abertura, fechamento por botão/fundo/Escape, restauração de rolagem).
- Build e typecheck passaram; lint sem erros, com aviso preexistente em escalas/page.tsx.
- Reutiliza `get_schedule_team` para as escalas do calendário pessoal; mantém autorização no banco. Sem migration.
- CodeRabbit indisponível neste ambiente; não foi executado teste com sessão autenticada real no navegador.


### Consulta de equipes pelos membros

Solicitação: permitir que membros consultem a equipe do dia para avaliar trocas.

- [x] Consultar escalas publicadas dos setores com vínculo ativo, inclusive sem participação própria, restritas à igreja ativa.
- [x] Mostrar equipes na janela e manter ações pessoais restritas ao dono.
- [x] Validar código e banco; enviar para publicação pela integração GitHub/Vercel.

Arquivos: `supabase/migrations/20260906020000_member_sector_calendar.sql`, `src/app/painel/calendario/page.tsx`, `src/features/calendar/calendar-hardening.test.ts`, `docs/stories/STAB-001.md`.

Validação desta extensão: 23 testes, lint (zero erros, um aviso preexistente), typecheck e build passaram. Build executado fora do sandbox após bloqueio de porta pelo Turbopack. Migration aplicada ao Supabase vinculado; lint SQL remoto sem erros. Sem teste ponta a ponta autenticado; CodeRabbit indisponível.


### Contadores pessoais no calendário

- [x] Contar somente escalas da própria pessoa nos indicadores diários e no total mensal, preservando consulta às equipes dos setores.
- Arquivos: `src/app/painel/calendario/page.tsx`, `docs/stories/STAB-001.md`.

Validação dos contadores: 23 testes, typecheck e build passaram; lint sem erros e com aviso preexistente. Escalas agrupadas por setor/evento, sem duplicar a contagem por função.

- [x] Exibir indicador numérico também quando a pessoa tem exatamente uma escala no dia (`count > 0`). Arquivos: `src/app/painel/calendario/page.tsx`, `docs/stories/STAB-001.md`.
