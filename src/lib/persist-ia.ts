import type { SupabaseClient } from "@supabase/supabase-js"
import { extractJsonArray } from "./ia-utils"

function resolveId(
  value: unknown,
  byId: Map<string, string>,
  byNome: Map<string, string>
): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (byId.has(s)) return s
  const lower = s.toLowerCase()
  if (byNome.has(lower)) return byNome.get(lower)!
  for (const [nome, id] of byNome) {
    if (nome.includes(lower) || lower.includes(nome)) return id
  }
  return null
}

function buildMaps<T extends { id: string; nome: string }>(items: T[]) {
  const byId = new Map<string, string>()
  const byNome = new Map<string, string>()
  for (const item of items) {
    byId.set(item.id, item.id)
    byNome.set(item.nome.toLowerCase(), item.id)
  }
  return { byId, byNome }
}

export async function persistGradeHorarios(
  supabase: SupabaseClient,
  escolaId: string,
  raw: unknown,
  turmas: { id: string; nome: string }[],
  materias: { id: string; nome: string }[],
  professores: { id: string; nome: string }[],
  periodos: { id: string; nome: string }[]
): Promise<{ ok: boolean; count: number; mensagem: string }> {
  const rows = extractJsonArray(raw, ["aulas", "grade", "horarios", "items"])
  if (!rows.length) {
    return { ok: false, count: 0, mensagem: "IA não retornou aulas válidas para a grade." }
  }

  const tMap = buildMaps(turmas)
  const mMap = buildMaps(materias)
  const pMap = buildMaps(professores)
  const perMap = buildMaps(periodos)

  const inserir: {
    escola_id: string
    turma_id: string
    materia_id: string
    professor_id: string
    dia_semana: number
    periodo_id: string
  }[] = []

  for (const row of rows) {
    const turmaId = resolveId(row.turma_id ?? row.turma ?? row.turma_nome, tMap.byId, tMap.byNome)
    const materiaId = resolveId(row.materia_id ?? row.materia ?? row.materia_nome, mMap.byId, mMap.byNome)
    const professorId = resolveId(
      row.professor_id ?? row.professor ?? row.professor_nome,
      pMap.byId,
      pMap.byNome
    )
    const periodoId = resolveId(row.periodo_id ?? row.periodo ?? row.periodo_nome, perMap.byId, perMap.byNome)

    if (!turmaId || !materiaId || !professorId || !periodoId) continue

    const dia = Number(row.dia_semana ?? row.dia ?? 0)
    inserir.push({
      escola_id: escolaId,
      turma_id: turmaId,
      materia_id: materiaId,
      professor_id: professorId,
      dia_semana: Math.min(4, Math.max(0, dia)),
      periodo_id: periodoId,
    })
  }

  if (!inserir.length) {
    return {
      ok: false,
      count: 0,
      mensagem: "Nenhuma aula pôde ser mapeada (verifique nomes/IDs de turma, matéria, professor e período).",
    }
  }

  await supabase.from("grade_horarios").delete().eq("escola_id", escolaId)
  const { error } = await supabase.from("grade_horarios").insert(inserir)
  if (error) return { ok: false, count: 0, mensagem: `Erro ao salvar grade: ${error.message}` }

  return { ok: true, count: inserir.length, mensagem: `Grade horária salva com ${inserir.length} aula(s)!` }
}

export async function persistRecreioIntercalado(
  supabase: SupabaseClient,
  escolaId: string,
  raw: unknown,
  turmas: { id: string; nome: string; periodo?: string }[]
): Promise<{ ok: boolean; count: number; mensagem: string }> {
  const rows = extractJsonArray(raw, ["horarios", "recreios", "items", "lista"])
  if (!rows.length) {
    return { ok: false, count: 0, mensagem: "IA não retornou horários de recreio válidos." }
  }

  const tMap = buildMaps(turmas)
  const inserir: {
    escola_id: string
    turma_id: string
    dia_semana: number
    hora_inicio: string
    hora_fim: string
  }[] = []

  for (const row of rows) {
    const turmaId = resolveId(row.turma_id ?? row.turma ?? row.turma_nome, tMap.byId, tMap.byNome)
    if (!turmaId) continue
    const dia = Number(row.dia_semana ?? row.dia ?? 0)
    inserir.push({
      escola_id: escolaId,
      turma_id: turmaId,
      dia_semana: Math.min(4, Math.max(0, dia)),
      hora_inicio: String(row.hora_inicio ?? row.inicio ?? "10:00"),
      hora_fim: String(row.hora_fim ?? row.fim ?? "10:20"),
    })
  }

  if (!inserir.length) {
    return { ok: false, count: 0, mensagem: "Nenhum recreio pôde ser mapeado às turmas." }
  }

  await supabase.from("recreio_intercalado").delete().eq("escola_id", escolaId)
  const { error } = await supabase.from("recreio_intercalado").insert(inserir)
  if (error) return { ok: false, count: 0, mensagem: `Erro ao salvar recreio: ${error.message}` }

  return { ok: true, count: inserir.length, mensagem: `Recreios salvos para ${inserir.length} turma(s)!` }
}