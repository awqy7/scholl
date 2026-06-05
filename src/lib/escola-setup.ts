import type { SupabaseClient } from "@supabase/supabase-js"
import { getConfigTipo, normalizarTipoEscola } from "@/lib/escola-tipo"
import { garantirPeriodosParaGrade } from "@/lib/garantir-periodos-grade"

export interface SetupEscolaResult {
  series: number
  turmas: number
  professores: number
  materias: number
  periodos: number
  mensagem: string
  tipo: "creche" | "normal"
}

/** Cria séries, turmas, professores, matérias e períodos conforme o tipo da escola. */
export async function garantirDadosEscola(
  supabase: SupabaseClient,
  escolaId: string,
  options: { completo?: boolean; tipo?: string | null } = {}
): Promise<SetupEscolaResult> {
  const stats = { series: 0, turmas: 0, professores: 0, materias: 0, periodos: 0 }
  const linhas: string[] = []

  const { data: escolaRow } = await supabase
    .from("escolas")
    .select("id, nome, tipo")
    .eq("id", escolaId)
    .maybeSingle()

  const tipo = normalizarTipoEscola(options.tipo ?? escolaRow?.tipo)
  const cfg = getConfigTipo(tipo)

  if (!escolaRow) {
    await supabase.from("escolas").insert({
      id: escolaId,
      nome: "Minha Escola",
      tipo,
    })
  }

  const [seriesRes, turmasRes, profsRes, materiasRes, periodosRes] = await Promise.all([
    supabase.from("series").select("id, nome, ordem").eq("escola_id", escolaId),
    supabase.from("turmas").select("id").eq("escola_id", escolaId),
    supabase.from("professores").select("id, status").eq("escola_id", escolaId),
    supabase.from("materias").select("id").eq("escola_id", escolaId),
    supabase.from("periodos").select("id, tipo").eq("escola_id", escolaId),
  ])

  let series = seriesRes.data || []

  if (series.length === 0) {
    const { data: inserted } = await supabase
      .from("series")
      .insert(cfg.seriesPadrao.map((s) => ({ ...s, escola_id: escolaId })))
      .select("id, nome, ordem")
    if (inserted?.length) {
      series = inserted
      stats.series = inserted.length
      linhas.push(`• ${inserted.length} ${cfg.recursos.rotuloSeries.toLowerCase()}`)
    }
  }

  if ((turmasRes.data?.length || 0) === 0 && series.length > 0) {
    const turmasInsert = cfg.turmasPadrao(series).map((t) => ({
      escola_id: escolaId,
      serie_id: t.serie_id,
      nome: t.nome,
      periodo: t.periodo,
    }))
    const { data: turmas } = await supabase.from("turmas").insert(turmasInsert).select("id")
    if (turmas?.length) {
      stats.turmas = turmas.length
      linhas.push(`• ${turmas.length} ${cfg.recursos.rotuloTurmas.toLowerCase()}`)
    }
  }

  const profs = profsRes.data || []
  const presentes = profs.filter((p) => p.status === "presente")
  if (profs.length === 0) {
    const { data: novos } = await supabase
      .from("professores")
      .insert(cfg.professoresPadrao.map((p) => ({ ...p, escola_id: escolaId })))
      .select("id")
    if (novos?.length) {
      stats.professores = novos.length
      linhas.push(`• ${novos.length} professores`)
    }
  } else if (presentes.length === 0 && profs[0]) {
    await supabase.from("professores").update({ status: "presente" }).eq("id", profs[0].id)
    linhas.push("• 1 professor marcado como presente")
  }

  if ((materiasRes.data?.length || 0) === 0) {
    const { data: mats } = await supabase
      .from("materias")
      .insert(cfg.materiasPadrao.map((m) => ({ ...m, escola_id: escolaId })))
      .select("id")
    if (mats?.length) {
      stats.materias = mats.length
      linhas.push(`• ${mats.length} matérias`)
    }
  }

  const periodos = periodosRes.data || []
  const periodosAula = periodos.filter((p) => p.tipo === "aula")
  if (periodos.length === 0) {
    const { data: pers } = await supabase
      .from("periodos")
      .insert(cfg.periodosPadrao.map((p) => ({ ...p, escola_id: escolaId })))
      .select("id")
    if (pers?.length) {
      stats.periodos = pers.length
      linhas.push(`• ${pers.length} períodos/horários`)
    }
  } else if (periodosAula.length === 0) {
    const aulasOnly = cfg.periodosPadrao.filter((p) => p.tipo === "aula")
    const { data: pers } = await supabase
      .from("periodos")
      .insert(aulasOnly.map((p) => ({ ...p, escola_id: escolaId })))
      .select("id")
    if (pers?.length) {
      stats.periodos = pers.length
      linhas.push(`• ${pers.length} períodos de aula`)
    }
  }

  const prepPeriodos = await garantirPeriodosParaGrade(supabase, escolaId)
  if (prepPeriodos.criados > 0) {
    stats.periodos += prepPeriodos.criados
    linhas.push(`• ${prepPeriodos.criados} períodos vespertinos (para turmas da tarde)`)
  }

  const totalCriados =
    stats.series + stats.turmas + stats.professores + stats.materias + stats.periodos

  let mensagem: string
  if (totalCriados === 0) {
    mensagem = options.completo
      ? `Estrutura **${cfg.label}** já existia — usei os dados do banco.`
      : "Dados mínimos já existiam no banco."
  } else {
    mensagem = `**Estrutura ${cfg.label} criada:**\n${linhas.join("\n")}`
  }

  return { ...stats, mensagem, tipo }
}