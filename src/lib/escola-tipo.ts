export type TipoEscola = "creche" | "normal"

export interface RecursosTipoEscola {
  recreioIntercalado: boolean
  rotuloTurmas: string
  rotuloSeries: string
  planejamentoSemanal: boolean
}

export interface ConfigTipoEscola {
  tipo: TipoEscola
  label: string
  descricao: string
  recursos: RecursosTipoEscola
  seriesPadrao: { nome: string; ordem: number }[]
  turmasPadrao: (series: { id: string; nome: string }[]) => {
    serie_id: string
    nome: string
    periodo: "manha" | "tarde" | "integral"
  }[]
  professoresPadrao: {
    nome: string
    email: string
    especialidades: string[]
    status: "presente"
    carga_horaria: number
  }[]
  materiasPadrao: { nome: string; cor: string }[]
  periodosPadrao: {
    nome: string
    tipo: "entrada" | "aula" | "recreio" | "saida"
    hora_inicio: string
    hora_fim: string
    ordem: number
  }[]
  promptModuloIA: string
  sugestoesAria: string[]
}

const SERIES_CRECHE = [
  { nome: "Berçário", ordem: 1 },
  { nome: "Maternal I", ordem: 2 },
  { nome: "Maternal II", ordem: 3 },
  { nome: "Jardim I", ordem: 4 },
  { nome: "Jardim II", ordem: 5 },
  { nome: "Pré I", ordem: 6 },
  { nome: "Pré II", ordem: 7 },
]

const SERIES_NORMAL = [
  { nome: "1º Ano", ordem: 1 },
  { nome: "2º Ano", ordem: 2 },
  { nome: "3º Ano", ordem: 3 },
  { nome: "4º Ano", ordem: 4 },
  { nome: "5º Ano", ordem: 5 },
  { nome: "6º Ano", ordem: 6 },
  { nome: "7º Ano", ordem: 7 },
  { nome: "8º Ano", ordem: 8 },
  { nome: "9º Ano", ordem: 9 },
]

function turmasCreche(series: { id: string; nome: string }[]) {
  const by = (n: string) => series.find((s) => s.nome === n)?.id ?? series[0]?.id
  return [
    { serie_id: by("Berçário"), nome: "Berçário A", periodo: "manha" as const },
    { serie_id: by("Maternal I"), nome: "Maternal I A", periodo: "manha" as const },
    { serie_id: by("Maternal I"), nome: "Maternal I B", periodo: "tarde" as const },
    { serie_id: by("Jardim I"), nome: "Jardim I A", periodo: "manha" as const },
    { serie_id: by("Jardim II"), nome: "Jardim II A", periodo: "tarde" as const },
    { serie_id: by("Pré I"), nome: "Pré I A", periodo: "integral" as const },
  ]
}

function turmasNormal(series: { id: string; nome: string }[]) {
  const by = (n: string) => series.find((s) => s.nome === n)?.id ?? series[0]?.id
  return [
    { serie_id: by("1º Ano"), nome: "1º Ano A", periodo: "manha" as const },
    { serie_id: by("2º Ano"), nome: "2º Ano A", periodo: "manha" as const },
    { serie_id: by("3º Ano"), nome: "3º Ano A", periodo: "tarde" as const },
    { serie_id: by("4º Ano"), nome: "4º Ano A", periodo: "manha" as const },
    { serie_id: by("5º Ano"), nome: "5º Ano A", periodo: "tarde" as const },
  ]
}

export const CONFIG_POR_TIPO: Record<TipoEscola, ConfigTipoEscola> = {
  creche: {
    tipo: "creche",
    label: "Creche / Educação Infantil",
    descricao: "Berçário, maternal e pré — com recreio intercalado entre salas",
    recursos: {
      recreioIntercalado: true,
      rotuloTurmas: "Salas",
      rotuloSeries: "Faixas etárias",
      planejamentoSemanal: true,
    },
    seriesPadrao: SERIES_CRECHE,
    turmasPadrao: turmasCreche,
    professoresPadrao: [
      {
        nome: "Maria Silva",
        email: "maria@escola.com",
        especialidades: ["Educação Infantil", "BNCC Infantil"],
        status: "presente",
        carga_horaria: 30,
      },
      {
        nome: "Ana Oliveira",
        email: "ana@escola.com",
        especialidades: ["Ludicidade", "Artes"],
        status: "presente",
        carga_horaria: 25,
      },
      {
        nome: "Carlos Lima",
        email: "carlos@escola.com",
        especialidades: ["Desenvolvimento Motor", "Educação Física"],
        status: "presente",
        carga_horaria: 20,
      },
      {
        nome: "Lucia Ferreira",
        email: "lucia@escola.com",
        especialidades: ["Psicopedagogia", "Acolhimento"],
        status: "presente",
        carga_horaria: 30,
      },
      {
        nome: "Julia Costa",
        email: "julia@escola.com",
        especialidades: ["Música e Movimento", "Linguagem Oral"],
        status: "presente",
        carga_horaria: 25,
      },
    ],
    materiasPadrao: [
      { nome: "Ludicidade", cor: "#EC4899" },
      { nome: "Desenvolvimento Motor", cor: "#14B8A6" },
      { nome: "Linguagem Oral", cor: "#3B82F6" },
      { nome: "Música e Movimento", cor: "#6366F1" },
      { nome: "Natureza e Sociedade", cor: "#10B981" },
      { nome: "Acolhimento", cor: "#F59E0B" },
      { nome: "Rotina e Autonomia", cor: "#8B5CF6" },
      { nome: "Educação Infantil", cor: "#84CC16" },
    ],
    periodosPadrao: [
      { nome: "Entrada", tipo: "entrada", hora_inicio: "07:00", hora_fim: "07:30", ordem: 1 },
      { nome: "Atividade 1", tipo: "aula", hora_inicio: "07:30", hora_fim: "08:20", ordem: 2 },
      { nome: "Lanche", tipo: "recreio", hora_inicio: "08:20", hora_fim: "08:40", ordem: 3 },
      { nome: "Atividade 2", tipo: "aula", hora_inicio: "08:40", hora_fim: "09:30", ordem: 4 },
      { nome: "Recreio", tipo: "recreio", hora_inicio: "09:30", hora_fim: "10:00", ordem: 5 },
      { nome: "Atividade 3", tipo: "aula", hora_inicio: "10:00", hora_fim: "10:50", ordem: 6 },
      { nome: "Almoço", tipo: "recreio", hora_inicio: "11:00", hora_fim: "11:40", ordem: 7 },
      { nome: "Saída", tipo: "saida", hora_inicio: "11:40", hora_fim: "12:00", ordem: 8 },
    ],
    promptModuloIA: `MODO CRECHE (Educação Infantil):
- Turmas são SALAS por faixa etária (Berçário, Maternal, Jardim, Pré).
- Use gerar_recreio e montar_escola_completa com gerar_recreio:true para organizar RECREIO INTERCALADO entre salas (evita todas no pátio juntas).
- Matérias típicas: Ludicidade, Desenvolvimento Motor, Linguagem Oral, Música e Movimento, Acolhimento — não use grade de ensino fundamental.
- Professores com especialidade em Educação Infantil, BNCC Infantil, Psicopedagogia.
- Períodos incluem lanche, recreio e almoço; rotinas curtas.`,
    sugestoesAria: [
      "🏫 Crie salas Maternal A e Jardim I B",
      "🔄 Organize o recreio intercalado",
      "👥 Cadastre 3 professoras de educação infantil",
      "📅 Gere a rotina das salas",
    ],
  },
  normal: {
    tipo: "normal",
    label: "Escola Regular",
    descricao: "Ensino fundamental — grade horária, matérias e substituições",
    recursos: {
      recreioIntercalado: false,
      rotuloTurmas: "Turmas",
      rotuloSeries: "Séries / Anos",
      planejamentoSemanal: true,
    },
    seriesPadrao: SERIES_NORMAL,
    turmasPadrao: turmasNormal,
    professoresPadrao: [
      {
        nome: "Maria Silva",
        email: "maria@escola.com",
        especialidades: ["Matemática"],
        status: "presente",
        carga_horaria: 30,
      },
      {
        nome: "João Santos",
        email: "joao@escola.com",
        especialidades: ["Português", "Literatura"],
        status: "presente",
        carga_horaria: 25,
      },
      {
        nome: "Ana Oliveira",
        email: "ana@escola.com",
        especialidades: ["Ciências"],
        status: "presente",
        carga_horaria: 25,
      },
      {
        nome: "Carlos Lima",
        email: "carlos@escola.com",
        especialidades: ["Educação Física"],
        status: "presente",
        carga_horaria: 20,
      },
      {
        nome: "Pedro Almeida",
        email: "pedro@escola.com",
        especialidades: ["História", "Geografia"],
        status: "presente",
        carga_horaria: 30,
      },
    ],
    materiasPadrao: [
      { nome: "Matemática", cor: "#EF4444" },
      { nome: "Português", cor: "#3B82F6" },
      { nome: "Ciências", cor: "#10B981" },
      { nome: "História", cor: "#F59E0B" },
      { nome: "Geografia", cor: "#8B5CF6" },
      { nome: "Artes", cor: "#EC4899" },
      { nome: "Educação Física", cor: "#14B8A6" },
      { nome: "Inglês", cor: "#F97316" },
    ],
    periodosPadrao: [
      { nome: "Entrada", tipo: "entrada", hora_inicio: "07:30", hora_fim: "08:00", ordem: 1 },
      { nome: "1º Período", tipo: "aula", hora_inicio: "08:00", hora_fim: "08:50", ordem: 2 },
      { nome: "2º Período", tipo: "aula", hora_inicio: "08:50", hora_fim: "09:40", ordem: 3 },
      { nome: "Recreio", tipo: "recreio", hora_inicio: "09:40", hora_fim: "10:00", ordem: 4 },
      { nome: "3º Período", tipo: "aula", hora_inicio: "10:00", hora_fim: "10:50", ordem: 5 },
      { nome: "4º Período", tipo: "aula", hora_inicio: "10:50", hora_fim: "11:40", ordem: 6 },
      { nome: "Saída", tipo: "saida", hora_inicio: "11:40", hora_fim: "12:00", ordem: 7 },
    ],
    promptModuloIA: `MODO ESCOLA REGULAR:
- Turmas por ANO/SÉRIE (1º ao 9º ano). Grade horária com matérias disciplinares.
- NÃO use gerar_recreio nem recreio intercalado — isso é exclusivo de creche.
- montar_escola_completa: use gerar_grade:true, gerar_recreio:false.
- Foco em substituições, faltas, grade e planejamento semanal.`,
    sugestoesAria: [
      "📅 Gere a grade horária completa",
      "👥 Cadastre professores de Matemática e Português",
      "📚 Crie matérias do fundamental",
      "⚠️ Verifique conflitos na grade",
    ],
  },
}

export function normalizarTipoEscola(valor?: string | null): TipoEscola {
  return valor === "creche" ? "creche" : "normal"
}

export function getConfigTipo(tipo?: string | null): ConfigTipoEscola {
  return CONFIG_POR_TIPO[normalizarTipoEscola(tipo)]
}

export function escolaTemRecreioIntercalado(tipo?: string | null): boolean {
  return getConfigTipo(tipo).recursos.recreioIntercalado
}

export function mensagemInicialAria(tipo?: string | null): string {
  const cfg = getConfigTipo(tipo)
  const linhaRecreio = cfg.recursos.recreioIntercalado
    ? "\n• 🔄 Organizar **recreio intercalado** entre salas (exclusivo creche)"
    : ""
  return `🎯 **ARIA** — ${cfg.label}

Olá! Sou a **ARIA**. Fale como diretor — eu cadastro ${cfg.recursos.rotuloTurmas.toLowerCase()}, professores, matérias e executo no banco.

**Neste modo você pode:**
• 📝 Criar/editar ${cfg.recursos.rotuloTurmas.toLowerCase()}, professores e matérias
• 📋 Faltas e substituições
• 📅 Gerar grade horária${linhaRecreio}
• 📊 Analisar a escola

**Exemplos:**
${cfg.sugestoesAria.map((s) => `- *"${s.replace(/^[^\s]+\s/, "")}"*`).join("\n")}

💡 Fale naturalmente que eu entendo!`
}

export function mensagemRecursoIndisponivel(acao: string, tipo?: string | null): string {
  const cfg = getConfigTipo(tipo)
  if (acao === "gerar_recreio") {
    return `🚫 **Recreio intercalado** é exclusivo de **Creche / Educação Infantil**. Sua escola está no modo **${cfg.label}**. Use a grade horária e períodos de recreio fixos.`
  }
  return `Esta função não está disponível para o tipo **${cfg.label}**.`
}