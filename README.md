# ATOS — Agenda de Times, Organização e Serviço

Aplicação web multi-igreja para escalas de Técnica, Mídia, Oficiais, Louvor, Recepção e Kids.

## Requisitos

- Node.js 22 (`nvm use` na pasta do projeto seleciona a versão correta)
- Um projeto Supabase

## Executar localmente

1. Copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Execute `npm install`.
4. Execute `npm run dev`.
5. Acesse `http://localhost:3000`.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Os requisitos estão em `docs/product/prd.md`, a arquitetura em `docs/architecture/architecture.md` e as stories em `docs/stories/`.
