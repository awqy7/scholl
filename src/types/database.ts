export type TipoEscolaDb = "creche" | "normal"

export interface Escola {
  id: string
  nome: string
  tipo: TipoEscolaDb
  created_at: string
}

export interface Serie {
  id: string
  escola_id: string
  nome: string
  ordem: number
}

export interface Turma {
  id: string
  escola_id: string
  serie_id: string
  nome: string
  periodo: "manha" | "tarde" | "integral"
  created_at: string
  // Responsáveis padrão da sala (usados para automação no recreio escalonado etc.)
  professor_responsavel_id?: string | null
  monitor_responsavel_id?: string | null
  serie?: Serie
  professores?: Professor[]
  // Joins quando carregados
  professor_responsavel?: Professor
  monitor_responsavel?: Monitor
}

export interface Professor {
  id: string
  escola_id: string
  nome: string
  email: string
  telefone: string
  especialidades: string[]
  status: "presente" | "ausente" | "ferias" | "licenca" | "atestado"
  carga_horaria: number
  created_at: string
}

export interface Materia {
  id: string
  escola_id: string
  nome: string
  cor: string
  created_at: string
}

export interface Periodo {
  id: string
  escola_id: string
  nome: string
  tipo: "entrada" | "aula" | "recreio" | "saida"
  hora_inicio: string
  hora_fim: string
  ordem: number
}

export interface GradeHorario {
  id: string
  escola_id: string
  turma_id: string
  materia_id: string
  professor_id: string
  dia_semana: number
  periodo_id: string
  created_at: string
  materia?: Materia
  professor?: Professor
  periodo?: Periodo
}

export interface RecreioIntercalado {
  id: string
  escola_id: string
  turma_id: string
  dia_semana: number
  hora_inicio: string
  hora_fim: string
  created_at: string
  turma?: Turma
}

export interface Falta {
  id: string
  escola_id: string
  professor_id: string
  data: string
  motivo: string
  status: "justificada" | "injustificada"
  created_at: string
  professor?: Professor
}

export interface Substituicao {
  id: string
  escola_id: string
  falta_id: string
  professor_original_id: string
  professor_substituto_id: string
  data: string
  status: "pendente" | "confirmada" | "recusada"
  created_at: string
  professor_original?: Professor
  professor_substituto?: Professor
}

export interface PlanejamentoSemanal {
  id: string
  escola_id: string
  turma_id: string
  materia_id: string
  professor_id: string
  semana_inicio: string
  conteudo: string
  objetivos: string
  created_at: string
  turma?: Turma
  materia?: Materia
  professor?: Professor
}

export interface EventoTempoReal {
  id: string
  escola_id: string
  tipo: "inicio_aula" | "fim_aula" | "inicio_recreio" | "fim_recreio" | "falta" | "substituicao" | "alerta"
  mensagem: string
  turma_id?: string
  professor_id?: string
  created_at: string
  turma?: Turma
  professor?: Professor
}

// ============================================
// CRECHE - RECREIO ESCALONADO COMPLETO
// ============================================

export interface Monitor {
  id: string
  escola_id: string
  nome: string
  telefone?: string | null
  created_at: string
}

export interface RecreioSupervisao {
  id: string
  escola_id: string
  periodo_id: string
  dia_semana: number
  turma_id: string
  professor_id?: string | null
  monitor_id?: string | null
  created_at: string

  // Joins
  turma?: Turma
  periodo?: Periodo
  professor?: Professor
  monitor?: Monitor
}

export interface RecreioAtividade {
  id: string
  recreio_supervisao_id: string
  descricao: string
  duracao_minutos?: number | null
  ordem: number
  created_at: string
}
