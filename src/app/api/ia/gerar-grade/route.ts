import { NextResponse } from "next/server"
import {
  filtrarAulasSemConflitoHorario,
  gerarGradeTodosTurnosDetalhe,
  validarGrade,
  type PeriodoGrade,
} from "@/lib/grade-gerador"
import {
  garantirPeriodosParaGrade,
  resumoTurnosGrade,
} from "@/lib/garantir-periodos-grade"
import { turnosComTurmas } from "@/lib/grade-turno"
import { persistGradeHorarios } from "@/lib/persist-ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 90

export async function POST() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const { supabase, escolaId } = auth

  try {
    const prep = await garantirPeriodosParaGrade(supabase, escolaId)
    if (prep.mensagem && prep.criados === 0 && prep.temTurmaTarde && !prep.temPeriodoVespertino) {
      return NextResponse.json({ error: prep.mensagem }, { status: 500 })
    }

    const [tRes, mRes, profRes, perRes] = await Promise.all([
      supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId).order("nome"),
      supabase.from("materias").select("id, nome").eq("escola_id", escolaId),
      supabase
        .from("professores")
        .select("id, nome, especialidades")
        .eq("escola_id", escolaId)
        .eq("status", "presente"),
      supabase.from("periodos").select("id, nome, tipo, ordem, hora_inicio, hora_fim").eq("escola_id", escolaId).order("ordem"),
    ])

    const turmas = tRes.data || []
    const materias = mRes.data || []
    const professores = profRes.data || []
    const periodos = (perRes.data || []) as PeriodoGrade[]

    if (!turmas.length || !materias.length || !professores.length || !periodos.length) {
      return NextResponse.json(
        {
          error:
            "Dados insuficientes. Cadastre turmas (manhã e tarde), matérias, professores presentes e períodos.",
        },
        { status: 400 }
      )
    }

    const turnos = turnosComTurmas(turmas)
    const detalhe = gerarGradeTodosTurnosDetalhe({
      turmas,
      materias,
      professores,
      periodos,
    })

    let { aulas, ignoradas } = filtrarAulasSemConflitoHorario(detalhe.aulas)

    if (!aulas.length) {
      const aviso =
        detalhe.avisos.length > 0
          ? detalhe.avisos.join(" ")
          : "Cadastre mais professores (mínimo 1 por sala em cada horário) ou verifique turmas manhã/tarde."
      return NextResponse.json(
        {
          error: `Não foi possível montar a grade. ${aviso}`,
          turnos,
          avisos: detalhe.avisos,
        },
        { status: 422 }
      )
    }

    const periodosAula = periodos.filter((p) => p.tipo === "aula")
    let validacao = validarGrade(aulas, periodosAula, turmas, professores)

    if (!validacao.ok) {
      const retry = filtrarAulasSemConflitoHorario(detalhe.aulas)
      aulas = retry.aulas
      ignoradas += retry.ignoradas
      validacao = validarGrade(aulas, periodosAula, turmas, professores)
    }

    if (!validacao.ok || !aulas.length) {
      return NextResponse.json(
        {
          error: `Grade inválida: ${[...validacao.conflitos, ...validacao.sequenciasLongas].slice(0, 2).join("; ")}`,
          validacao,
        },
        { status: 422 }
      )
    }

    await supabase.from("grade_horarios").delete().eq("escola_id", escolaId)

    const resultado = await persistGradeHorarios(
      supabase,
      escolaId,
      { aulas },
      turmas.map((t) => ({ id: t.id, nome: t.nome })),
      materias.map((m) => ({ id: m.id, nome: m.nome })),
      professores.map((p) => ({ id: p.id, nome: p.nome })),
      periodos.map((p) => ({ id: p.id, nome: p.nome, tipo: p.tipo, ordem: p.ordem }))
    )

    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.mensagem }, { status: 500 })
    }

    const resumoTurnos = resumoTurnosGrade(turmas, periodos, aulas)
    const prepMsg = prep.criados > 0 ? ` ${prep.mensagem}` : ""

    return NextResponse.json({
      ok: true,
      aulas,
      modo: "algoritmo",
      count: resultado.count,
      mensagem: resultado.mensagem,
      resumo: `Matutino + Vespertino: ${resumoTurnos}.${prepMsg}`,
      resumoTurnos,
      validacao,
      ignoradas,
      turnosGerados: detalhe.turnosProcessados.length ? detalhe.turnosProcessados : turnos,
      avisos: detalhe.avisos,
      periodosVespertinoCriados: prep.criados,
    })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}