# 🏫 Escola Inteligente

Sistema completo de gestão escolar com inteligência artificial.

## ✨ Funcionalidades

- **Dashboard em Tempo Real** - Timeline minuto a minuto do que acontece na escola
- **Grade Horária Inteligente** - Geração automática de horários via IA
- **Recreio Intercalado** - Administração automática de recreios (uma turma por vez)
- **Substituição Automática** - IA sugere o melhor professor substituto
- **Planejamento Semanal** - Gestão de conteúdo por turma/matéria
- **Controle de Faltas** - Registro e acompanhamento
- **Gestão Completa** - Turmas, Professores, Matérias, Períodos

## 🚀 Tecnologias

- **Frontend**: Next.js 16, React 19, Tailwind CSS 4
- **Backend**: Next.js API Routes, Server Actions
- **Banco**: Supabase (PostgreSQL + Auth + Realtime)
- **IA**: Google Gemini 2.0 Flash via OpenRouter (grátis)
- **Hospedagem**: Vercel

## 📦 Estrutura

```
src/
├── app/           # Páginas e API Routes
│   ├── dashboard/ # Timeline em tempo real
│   ├── grade/     # Grade horária com IA
│   ├── recreio/   # Recreio intercalado
│   ├── faltas/    # Controle de faltas
│   ├── substituicoes/ # Substituições com IA
│   ├── planejamento/  # Planejamento semanal
│   └── api/ia/    # Rotas da IA
├── components/    # Componentes reutilizáveis
├── lib/           # Utilitários, IA, Supabase
└── types/         # Tipagens TypeScript
```

## ⚙️ Setup

### 1. Clone e instale

```bash
npm install
```

### 2. Supabase

Crie um projeto em [supabase.com](https://supabase.com) e execute o SQL em `supabase/migrations/00001_schema.sql` no SQL Editor.

### 3. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
IA_API_KEY=sk-or-v1-sua-chave-openrouter
```

### 4. OpenRouter (IA grátis)

1. Crie conta em [openrouter.ai](https://openrouter.ai)
2. Gere uma chave API
3. Adicione no `.env.local` como `IA_API_KEY`

### 5. Rodar

```bash
npm run dev
```

### 6. Deploy na Vercel

```bash
npm install -g vercel
vercel
```

## 🤖 Como a IA funciona

- **Grade Horária**: A IA recebe turmas, professores, matérias e gera a grade semanal otimizada
- **Substituição**: Quando um professor falta, a IA analisa especialidades e disponibilidade para sugerir o melhor substituto
- **Recreio**: Distribui os recreios garantindo apenas uma turma por vez

Tudo via API grátis do Google Gemini 2.0 Flash.
