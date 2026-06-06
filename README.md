# ARIA — Gestão Escolar Real

Sistema completo de gestão escolar (creche + ensino fundamental) feito para ser **rápido, confiável e controlado por humanos**.

**Filosofia atual:**
- Diretor e secretaria fazem **todos os cadastros, faltas, substituições e ajustes de grade manualmente** (mais seguro, auditável e rápido).
- A **ARIA** é a assistente inteligente que **analisa, dá dicas, prevê problemas, gera relatórios e sugere** as melhores decisões. Ela **não altera dados sozinha**.

## Principais melhorias recentes (executadas)
- Modelo de tenancy correto (suporte a múltiplos usuários por escola: diretor + secretaria etc) + RLS consertado.
- IA removida da execução automática de ações (pivot para advisor).
- Chat da ARIA agora foca em análise, relatórios e sugestões.
- Páginas de CRUD melhoradas (busca, confirmações, resolução segura de escola).
- Resolução de `escola_id` via `escola_membros` (com fallback legacy).

## Desenvolvimento

```bash
npm install
npm run dev
```

**Importante:** Configure `.env.local` (veja `.env.local.example` com GROQ_API_KEY + Supabase).

### Após clonar / atualizar (obrigatório para o modelo novo de escola)
1. No Supabase SQL Editor, rode a migration mais recente:
   ```sql
   -- Abra o arquivo:
   supabase/migrations/00005_tenancy_members_rls_fix.sql
   -- Cole e execute todo o conteúdo.
   ```
   Isso cria `escola_membros`, conserta RLS e faz backfill para contas antigas.

2. Reinicie o dev server.

## Como usar no dia a dia (novo modo)
- Cadastros, faltas, grade, substituições → use as páginas do menu (rápidas e diretas).
- Análise e inteligência → clique no botão roxo (ARIA) no canto inferior direito e converse:
  - "Analise minha escola"
  - "Prever faltas"
  - "Relatório da professora Ana"
  - "Sugestões de melhoria"

## Testes da IA (analítica)

```bash
npm run test:ia
npm run test:groq
```

O sistema foi redesenhado para ser a ferramenta real que o diretor e a secretaria vão usar todos os dias com confiança.