# ARIA — Gestão Escolar

Sistema simples e rápido de gestão escolar para **creche e ensino fundamental**, feito para o diretor e a secretaria usarem todos os dias de forma direta e confiável.

**O que é:**  
Uma ferramenta manual-first. Você faz tudo manualmente (cadastros, rotinas, ausências). A IA (chamada ARIA) só analisa, sugere e dá dicas — nunca toma decisões nem altera dados sozinha.

**O que ele faz de mais importante:**
- Menu com apenas **6 seções claras** (Painel, Salas, Equipe, Rotina, Ausências, Planejamento) — fácil de entender e não se perde.
- Cada sala tem um **Professor e Monitor padrão**.
- **Rotina (Recreio Escalonado):** com um clique o sistema reconhece todas as salas que já têm padrão cadastrado e gera automaticamente um planejamento balanceado e seguro (máximo ~3 turmas por horário).
- **Ausências:** ao registrar uma falta, o sistema mostra imediatamente quais turmas ficam sem o responsável padrão, sugere substitutos que já são padrão daquelas mesmas salas, cria a substituição ligada e pode aplicar a cobertura direto nos horários de recreio de hoje.
- Tudo conversa entre si: as turmas são a fonte da verdade → a Equipe mostra "Padrão de: ..." → as Ausências usam isso para sugerir → a Rotina evita padrões ausentes e mostra badges de cobertura → o Dashboard avisa as salas sem cobertura.

**Como funciona no dia a dia:**
1. Cadastre as salas com seus Professor e Monitor padrão (uma única vez).
2. Vá em Rotina → clique "Gerar Planejamento Escalonado Automático".
3. Quando alguém faltar, use Ausências: o sistema faz o trabalho pesado de impacto e sugestão.
4. Veja tudo atualizado no Painel.

Rápido, auditável e pensado para o funcionamento real de creche (recreio com várias turmas, responsabilidade clara de professor + monitor, cobertura fácil).

**Tecnologia:** Next.js 16 + Supabase (banco + auth + RLS).

**Como rodar:**
```bash
npm install
npm run dev
```

Depois de subir, rode o arquivo `supabase/full_schema.sql` no SQL Editor do seu projeto Supabase (é o schema completo e único do sistema).

Pronto. O sistema é feito para ser usado de verdade, sem enrolação.