import type { Periodo } from "@/types/database"

export type TurnoTurma = "manha" | "tarde" | "integral"

export interface PeriodoComHorario {
  id: string
  nome: string
  tipo: string
  ordem: number
  hora_inicio?: string
  hora_fim?: string
}

export interface TurmaComTurno {
  id: string
  nome: string
  periodo?: TurnoTurma | string
}

export const TURNOS_ORDEM: TurnoTurma[] = ["manha", "tarde", "integral"]

export const LABEL_TURNO: Record<TurnoTurma, string> = {
  manha: "Matutino",
  tarde: "Vespertino",
  integral: "Integral",
}

export const LABEL_TURNO_CURTO: Record<TurnoTurma, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  integral: "Integral",
}

export function normalizarTurnoTurma(valor?: string | null): TurnoTurma {
  if (!valor) return "manha"
  const v = valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
  if (v === "tarde" || v === "vespertino") return "tarde"
  if (v === "integral") return "integral"
  return "manha"
}

/** Converte "08:30" ou "08:30:00" em minutos desde meia-noite. */
export function minutosDesdeMeiaNoite(hora: string): number {
  const partes = hora.trim().split(":")
  const h = Number(partes[0]) || 0
  const m = Number(partes[1]) || 0
  return h * 60 + m
}

/** Período vespertino: início a partir de 12h (meio-dia). */
export const CORTE_VESPERTINO_MINUTOS = 12 * 60

export function turnoDoHorario(horaInicio: string): "manha" | "tarde" {
  return minutosDesdeMeiaNoite(horaInicio) >= CORTE_VESPERTINO_MINUTOS ? "tarde" : "manha"
}

export function filtrarTurmasPorTurno<T extends TurmaComTurno>(
  turmas: T[],
  turno: TurnoTurma
): T[] {
  if (turno === "integral") {
    return turmas.filter((t) => normalizarTurnoTurma(t.periodo) === "integral")
  }
  return turmas.filter((t) => normalizarTurnoTurma(t.periodo) === turno)
}

/** Períodos de horário compatíveis com o turno (integral = dia todo). */
export function filtrarPeriodosPorTurno<T extends PeriodoComHorario>(
  periodos: T[],
  turno: TurnoTurma
): T[] {
  if (turno === "integral") return [...periodos]

  return periodos.filter((p) => {
    if (!p.hora_inicio) return turno === "manha"
    const t = turnoDoHorario(p.hora_inicio)
    return t === turno
  })
}

export function turnosComTurmas(turmas: TurmaComTurno[]): TurnoTurma[] {
  const set = new Set<TurnoTurma>()
  for (const t of turmas) set.add(normalizarTurnoTurma(t.periodo))
  return TURNOS_ORDEM.filter((k) => set.has(k))
}

export function turnoInicial(turmas: TurmaComTurno[]): TurnoTurma {
  const lista = turnosComTurmas(turmas)
  return lista[0] ?? "manha"
}

export function resumoTurno(
  turno: TurnoTurma,
  turmas: TurmaComTurno[],
  periodosAula: PeriodoComHorario[]
): string {
  const nTurmas = filtrarTurmasPorTurno(turmas, turno).length
  const nPer = filtrarPeriodosPorTurno(periodosAula, turno).filter((p) => p.tipo === "aula").length
  return `${LABEL_TURNO[turno]} · ${nTurmas} sala(s) · ${nPer} período(s) de aula`
}

/** Um período de aula por horário real (evita IDs duplicados no mesmo relógio). */
export function deduplicarPeriodosPorRelogio<T extends PeriodoComHorario>(periodos: T[]): T[] {
  const vistos = new Map<string, T>()
  for (const p of periodos) {
    if (p.tipo !== "aula") continue
    const key = `${p.hora_inicio || p.nome}|${p.hora_fim || ""}|${p.ordem}`
    if (!vistos.has(key)) vistos.set(key, p)
  }
  return [...vistos.values()].sort((a, b) => a.ordem - b.ordem)
}