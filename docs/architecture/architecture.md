# Arquitetura — AppEscala

## Stack inicial

- Next.js com App Router, React e TypeScript.
- Tailwind CSS e componentes acessíveis, mobile-first.
- Supabase para Auth, PostgreSQL, Storage, Realtime e funções de backend.
- Deploy web compatível com Vercel; PWA adicionada de forma incremental.

## Multi-tenancy e autorização

Uma conta pode pertencer a várias igrejas. Toda entidade de negócio recebe `church_id`. A autorização é relacional e validada no banco por Row Level Security, não apenas pela interface ou por claims potencialmente desatualizadas.

Papéis:

- Plataforma: `platform_admin`.
- Igreja: `church_admin` e `member`.
- Setor: `leader` e `member`.

Helpers SQL como `is_platform_admin`, `is_church_admin` e `is_department_leader` centralizam as policies. Todas as chaves estrangeiras usadas por policies devem ser indexadas. A chave `service_role` nunca é enviada ao navegador.

## Modelo inicial

- `profiles`
- `churches`
- `church_memberships`
- `platform_roles`
- `departments`
- `department_memberships`
- `positions`
- `member_positions`
- `services`
- `schedule_assignments`
- `availability`
- `swap_requests`
- `announcements` e `announcement_reads`
- `notifications`
- `calendar_connections` em schema privado
- `calendar_event_links`
- `integration_jobs`
- `push_subscriptions` em fase PWA
- `audit_logs`

Datas são armazenadas como `timestamptz` e exibidas conforme o fuso da igreja/usuário. Registros operacionais importantes são arquivados ou cancelados, evitando exclusão destrutiva.

## Google Calendar

Um calendário incorporado serve apenas para visualização. Para convites e lembretes, a integração usará OAuth e Google Calendar API no servidor. Eventos publicados, alterados, cancelados ou trocados geram jobs idempotentes, com retry, sem bloquear a operação principal.

O sistema mantém notificações internas independentes do Google. Como alternativa, oferece evento/feed ICS privado e revogável.

## Controles essenciais

- Testes automatizados de RLS entre igrejas e papéis.
- Aprovação de troca em transação/RPC.
- Tokens OAuth criptografados e revogáveis.
- Auditoria de permissões e alterações de escala.
- Consentimento e minimização de dados conforme LGPD.
- Ações críticas exigem conexão; offline futuro começa por shell e leitura recente.

