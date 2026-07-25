# PRD — AppEscala

## Visão

Aplicação web responsiva para organizar escalas de voluntários de igrejas, preparada para evolução como PWA e para atender múltiplas igrejas com isolamento de dados.

## Papéis

- **Administradora da plataforma:** administra igrejas e seus administradores.
- **Administradora da igreja:** aprova membros, configura setores e designa líderes.
- **Líder de setor:** cria escalas, acompanha confirmações, aprova trocas e publica comunicados no setor atribuído.
- **Voluntário:** pode participar de vários setores, confirmar escalas, solicitar trocas e consultar comunicados.

Um usuário pode acumular papéis e participar de várias igrejas e setores usando a mesma conta.

## Escopo do MVP

- Cadastro e autenticação com e-mail/senha e Google.
- Igrejas isoladas e preparadas para multi-tenancy.
- Setores iniciais: Técnica, Mídia, Oficiais, Louvor, Recepção e Kids.
- Aprovação de membros e designação de líderes pela administradora.
- Criação manual de escalas pelos líderes.
- Próxima escala, lista de escalas futuras, histórico e calendário mensal.
- Confirmação ou recusa de participação.
- Solicitação de troca com aprovação obrigatória do líder.
- Comunicados unidirecionais dos líderes.
- Notificações internas.
- Integração com Google Calendar e alternativa por arquivo/feed ICS.
- Perfil e disponibilidade básica.

## Fora do MVP

- Chat entre usuários.
- Geração automática de escalas.
- Aplicativos nativos para iOS ou Android.
- Login e notificações por WhatsApp.
- Cobrança, planos e relatórios avançados.

## Requisitos funcionais

- **FR-001:** permitir cadastro, login, logout e recuperação de senha por e-mail.
- **FR-002:** permitir autenticação com Google.
- **FR-003:** vincular usuários a uma ou mais igrejas sem compartilhar dados entre elas.
- **FR-004:** permitir à administradora aprovar membros e atribuir papéis.
- **FR-005:** permitir à administradora designar vários líderes por setor.
- **FR-006:** permitir que um usuário participe de vários setores e funções.
- **FR-007:** disponibilizar os seis setores iniciais e permitir novos setores no futuro.
- **FR-008:** permitir ao líder criar, editar, publicar e cancelar escalas do setor atribuído.
- **FR-009:** cada escala deve registrar evento, data, horário, local, setor, funções e participantes.
- **FR-010:** exibir próxima escala, futuras, histórico e calendário mensal.
- **FR-011:** permitir ao voluntário confirmar ou recusar uma convocação.
- **FR-012:** permitir solicitação de troca com motivo e substituto sugerido opcional.
- **FR-013:** permitir ao líder aprovar ou rejeitar a troca e escolher pessoa elegível.
- **FR-014:** efetivar uma troca somente após aceite do substituto e aprovação do líder.
- **FR-015:** permitir comunicados unidirecionais por setor ou escala.
- **FR-016:** gerar notificações para escala, lembrete, troca e comunicado.
- **FR-017:** permitir marcar notificações como lidas.
- **FR-018:** criar ou sincronizar compromissos com Google Calendar mediante consentimento.
- **FR-019:** permitir gerenciamento básico de perfil e disponibilidade.
- **FR-020:** restringir ações e dados conforme igreja, setor e papel.

## Requisitos não funcionais

- **NFR-001 Segurança:** Supabase Auth, RLS em tabelas expostas e segredos apenas no servidor.
- **NFR-002 Multi-tenancy:** toda entidade de negócio pertence a uma igreja.
- **NFR-003 Responsividade:** experiência completa a partir de 360 px.
- **NFR-004 Acessibilidade:** buscar WCAG 2.1 AA, teclado, foco visível e rótulos acessíveis.
- **NFR-005 Integridade:** alterações de escala e trocas devem ser transacionais e auditáveis.
- **NFR-006 Privacidade:** minimizar dados pessoais e preparar consentimento, exportação e exclusão conforme LGPD.
- **NFR-007 Manutenibilidade:** TypeScript, componentes reutilizáveis, lint, testes e documentação.
- **NFR-008 Portabilidade:** configuração por ambiente e deploy em provedores web modernos.
- **NFR-009 Evolução:** arquitetura preparada para PWA e notificações push futuras.
- **NFR-010 Compatibilidade:** duas versões mais recentes de Chrome, Safari, Edge e Firefox.

## Regras de negócio

- **BR-001:** nenhum usuário acessa dados de igreja sem vínculo ativo.
- **BR-002:** apenas administradores designam ou removem líderes.
- **BR-003:** líderes administram somente setores explicitamente atribuídos.
- **BR-004:** voluntários podem atuar em vários setores e funções.
- **BR-005:** escala publicada começa com participação pendente para cada convocado.
- **BR-006:** uma troca não remove o responsável original antes de sua conclusão.
- **BR-007:** substitutos devem estar habilitados no setor/função e sem conflito conhecido.
- **BR-008:** comunicados não aceitam respostas no MVP.
- **BR-009:** integração com Google depende de consentimento e sua revogação não bloqueia o app.
- **BR-010:** mudanças relevantes de escala e permissões mantêm autoria e data.

