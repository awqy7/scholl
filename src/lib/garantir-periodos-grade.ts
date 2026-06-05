import type { SupabaseClient } from "@supabase/supabase-js"
import {
  filtrarPeriodosPorTurno,
  normalizarTurnoTurma,
  turnoDoHorario,
  type PeriodoComHorario,
  type TurnoTurma,
} from "@/lib/grade-turno"

/** Horários vespertinos padrão (início ≥ 12h) quando há turmas da tarde sem períodos. */
export const PERIODOS_VESPERTINO_PADRAO: {
  nome: string
  tipo: "entrada" | "aula" | "recreio" | "saida"
  hora_inicio: string
  hora_fim: string
  ordem: number
}[] = [
  { nome: "Entrada (tarde)", tipo: "entrada", hora_inicio: "13:00", hora_fim: "13:20", ordem: 21 },
  { nome: "1º Período — tarde", tipo: "aula", hora_inicio: "13:20", hora_fim: "14:10", ordem: 22 },
  { nome: "2º Período — tarde", tipo: "aula", hora_inicio: "14:10", hora_fim: "15:00", ordem: 23 },
  { nome: "Recreio (tarde)", tipo: "recreio", hora_inicio: "15:00", hora_fim: "15:20", ordem: 24 },
  { nome: "3º Período — tarde", tipo: "aula", hora_inicio: "15:20", hora_fim: "16:10", ordem: 25 },
  { nome: "4º Período — tarde", tipo: "aula", hora_inicio: "16:10", hora_fim: "17:00", ordem: 26 },
  { nome: "Saída (tarde)", tipo: "saida", hora_inicio: "17:00", hora_fim: "17:30", ordem: 27 },
]

export interface GarantirPeriodosResult {
  criados: number
  mensagem: string
  temTurmaTarde: boolean
  temPeriodoVespertino: boolean
}

function periodosAulaDoTurno(periodos: PeriodoComHorario[], turno: "manha" | "tarde") {
  return filtrarPeriodosPorTurno(periodos, turno).filter((p) => p.tipo === "aula")
}

/**
 * Garante períodos vespertinos no banco quando existem turmas da tarde.
 * Sem isso a aba Vespertino e a geração da grade ficam vazias.
 */
export async function garantirPeriodosParaGrade(
  supabase: SupabaseClient,
  escolaId: string
): Promise<GarantirPeriodosResult> {
  const [{ data: turmas }, { data: periodos }] = await Promise.all([
    supabase.from("turmas").select("id, periodo").eq("escola_id", escolaId),
    supabase.from("periodos").select("id, nome, tipo, ordem, hora_inicio, hora_fim").eq("escola_id", escolaId),
  ])

  const listaPeriodos = (periodos || []) as PeriodoComHorario[]
  const temTurmaTarde = (turmas || []).some((t) => normalizarTurnoTurma(t.periodo) === "tarde")
  const aulasVesp = periodosAulaDoTurno(listaPeriodos, "tarde")
  const temPeriodoVespertino = aulasVesp.length > 0

  if (!temTurmaTarde) {
    return {
      criados: 0,
      mensagem: "",
      temTurmaTarde: false,
      temPeriodoVespertino: temPeriodoVespertino,
    }
  }

  if (temPeriodoVespertino) {
    return {
      criados: 0,
      mensagem: "",
      temTurmaTarde: true,
      temPeriodoVespertino: true,
    }
  }

  const maxOrdem = listaPeriodos.reduce((m, p) => Math.max(m, p.ordem || 0), 0)
  const baseOrdem = Math.max(maxOrdem, 20)

  const inserir = PERIODOS_VESPERTINO_PADRAO.map((p, i) => ({
    escola_id: escolaId,
    nome: p.nome,
    tipo: p.tipo,
    hora_inicio: p.hora_inicio,
    hora_fim: p.hora_fim,
    ordem: p.ordem > 20 ? p.ordem : baseOrdem + i + 1,
  }))

  const { data: criados, error } = await supabase.from("periodos").insert(inserir).select("id")

  if (error) {
    const espelhados = await espelharPeriodosVespertinoDaManha(supabase, escolaId)
    if (espelhados > 0) {
      return {
        criados: espelhados,
        mensagem: `Criados ${espelhados} períodos vespertinos (espelhados da manhã).`,
        temTurmaTarde: true,
        temPeriodoVespertino: true,
      }
    }
    return {
      criados: 0,
      mensagem: `Não foi possível criar horários vespertinos: ${error.message}`,
      temTurmaTarde: true,
      temPeriodoVespertino: false,
    }
  }

  return {
    criados: criados?.length || inserir.length,
    mensagem: `Criados ${criados?.length || inserir.length} períodos vespertinos para as turmas da tarde.`,
    temTurmaTarde: true,
    temPeriodoVespertino: true,
  }
}

export function resumoTurnosGrade(
  turmas: { id: string; periodo?: string }[],
  periodos: PeriodoComHorario[],
  aulas: { turma_id: string }[]
): string {
  const partes: string[] = []
  const turnos: TurnoTurma[] = ["manha", "tarde", "integral"]

  for (const turno of turnos) {
    const turmasTurno = turmas.filter((t) => normalizarTurnoTurma(t.periodo) === turno)
    if (!turmasTurno.length) continue

    const idsTurma = new Set(turmasTurno.map((t) => t.id))
    const nAulas = aulas.filter((a) => idsTurma.has(a.turma_id)).length
    const label =
      turno === "manha" ? "Matutino" : turno === "tarde" ? "Vespertino" : "Integral"
    const nPer =
      turno === "integral"
        ? periodos.filter((p) => p.tipo === "aula").length
        : periodosAulaDoTurno(periodos, turno).length
    partes.push(`${label}: ${nAulas} aulas (${turmasTurno.length} salas, ${nPer} horários)`)
  }

  return partes.join(" · ")
}

/** Espelha períodos de aula da manhã para a tarde (+5h) se houver turmas tarde e zero períodos tarde. */
export async function espelharPeriodosVespertinoDaManha(
  supabase: SupabaseClient,
  escolaId: string
): Promise<number> {
  const { data: periodos } = await supabase
    .from("periodos")
    .select("*")
    .eq("escola_id", escolaId)
    .order("ordem")

  if (!periodos?.length) return 0

  const manhaAulas = periodos.filter(
    (p) => p.tipo === "aula" && p.hora_inicio && turnoDoHorario(p.hora_inicio) === "manha"
  )
  const tardeAulas = periodos.filter(
    (p) => p.tipo === "aula" && p.hora_inicio && turnoDoHorario(p.hora_inicio) === "tarde"
  )
  if (!manhaAulas.length || tardeAulas.length) return 0

  const maxOrdem = periodos.reduce((m, p) => Math.max(m, p.ordem || 0), 0)
  const shiftMin = 5 * 60

  function addMinutes(hora: string, add: number): string {
    const m = (Number(hora.split(":")[0]) || 0) * 60 + (Number(hora.split(":")[1]) || 0) + add
    const h = Math.floor(m / 60) % 24
    const min = m % 60
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
  }

  const inserir = manhaAulas.map((p, i) => ({
    escola_id: escolaId,
    nome: `${p.nome} (tarde)`,
    tipo: "aula" as const,
    hora_inicio: addMinutes(p.hora_inicio, shiftMin),
    hora_fim: addMinutes(p.hora_fim, shiftMin),
    ordem: maxOrdem + i + 1,
  }))

  const { data } = await supabase.from("periodos").insert(inserir).select("id")
  return data?.length || 0
}