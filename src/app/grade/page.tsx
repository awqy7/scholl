"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loading } from "@/components/shared/loading"
import { validarGrade } from "@/lib/grade-gerador"
import {
  deduplicarPeriodosPorRelogio,
  filtrarPeriodosPorTurno,
  filtrarTurmasPorTurno,
  LABEL_TURNO,
  LABEL_TURNO_CURTO,
  resumoTurno,
  normalizarTurnoTurma,
  turnoInicial,
  turnosComTurmas,
  type TurnoTurma,
} from "@/lib/grade-turno"
import { filtrarAulasSemConflitoHorario } from "@/lib/grade-gerador"
import { useEscola } from "@/lib/escola-context"
import { GradeVertical } from "@/components/grade/grade-vertical"
import { Calendar, Sparkles, Trash2, CheckCircle2, AlertTriangle, Sun, Sunset, Clock } from "lucide-react"
import type { GradeHorario, Turma, Materia, Professor, Periodo } from "@/types/database"

export default function GradePage() {
  return (
    <AppShell>
      <GradeContent />
    </AppShell>
  )
}

function iconeTurno(turno: TurnoTurma) {
  if (turno === "tarde") return <Sunset className="h-4 w-4" />
  if (turno === "integral") return <Clock className="h-4 w-4" />
  return <Sun className="h-4 w-4" />
}

function GradeContent() {
  const supabase = createClient()
  const { config } = useEscola()
  const rotuloSalas = config.recursos.rotuloTurmas
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [grade, setGrade] = useState<GradeHorario[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [turnoAtivo, setTurnoAtivo] = useState<TurnoTurma>("manha")

  const periodosAula = useMemo(
    () => periodos.filter((p) => p.tipo === "aula").sort((a, b) => a.ordem - b.ordem),
    [periodos]
  )

  const turnosDisponiveis = useMemo(() => turnosComTurmas(turmas), [turmas])

  const turmasTurno = useMemo(
    () => filtrarTurmasPorTurno(turmas, turnoAtivo),
    [turmas, turnoAtivo]
  )

  const periodosTurno = useMemo(
    () =>
      deduplicarPeriodosPorRelogio(filtrarPeriodosPorTurno(periodosAula, turnoAtivo)),
    [periodosAula, turnoAtivo]
  )

  const idsTurmasTurno = useMemo(() => new Set(turmasTurno.map((t) => t.id)), [turmasTurno])

  const gradeTurno = useMemo(
    () => grade.filter((g) => idsTurmasTurno.has(g.turma_id)),
    [grade, idsTurmasTurno]
  )

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const eId = userData.user.id

    try {
      await fetch("/api/grade/preparar", { method: "POST" })
    } catch {
      /* períodos vespertinos são opcionais na carga */
    }

    const [tRes, mRes, pRes, perRes, gRes] = await Promise.all([
      supabase.from("turmas").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("materias").select("*").eq("escola_id", eId),
      supabase.from("professores").select("*").eq("escola_id", eId).eq("status", "presente"),
      supabase.from("periodos").select("*").eq("escola_id", eId).order("ordem"),
      supabase
        .from("grade_horarios")
        .select("*, materia:materias(*), professor:professores(*), periodo:periodos(*)")
        .eq("escola_id", eId),
    ])
    if (tRes.data) {
      setTurmas(tRes.data)
      setTurnoAtivo(turnoInicial(tRes.data))
    }
    if (mRes.data) setMaterias(mRes.data)
    if (pRes.data) setProfessores(pRes.data)
    if (perRes.data) setPeriodos(perRes.data)
    if (gRes.data) {
      setGrade(gRes.data)
      const bruta = gRes.data.map((g) => ({
        turma_id: g.turma_id,
        materia_id: g.materia_id,
        professor_id: g.professor_id,
        dia_semana: g.dia_semana,
        periodo_id: g.periodo_id,
      }))
      const { ignoradas } = filtrarAulasSemConflitoHorario(bruta)
      if (ignoradas > 0) {
        fetch("/api/grade/sanitizar", { method: "POST" }).then(async (res) => {
          if (res.ok) {
            const { data: nova } = await supabase
              .from("grade_horarios")
              .select("*, materia:materias(*), professor:professores(*), periodo:periodos(*)")
              .eq("escola_id", eId)
            if (nova) setGrade(nova)
          }
        })
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    if (!turnosDisponiveis.includes(turnoAtivo) && turnosDisponiveis.length) {
      setTurnoAtivo(turnosDisponiveis[0])
    }
  }, [turnosDisponiveis, turnoAtivo])

  const validacao = useMemo(() => {
    if (!gradeTurno.length) return null
    return validarGrade(
      gradeTurno.map((g) => ({
        turma_id: g.turma_id,
        materia_id: g.materia_id,
        professor_id: g.professor_id,
        dia_semana: g.dia_semana,
        periodo_id: g.periodo_id,
      })),
      periodosTurno,
      turmasTurno.map((t) => ({ id: t.id, nome: t.nome })),
      professores.map((p) => ({ id: p.id, nome: p.nome, especialidades: p.especialidades }))
    )
  }, [gradeTurno, periodosTurno, turmasTurno, professores])

  async function handleGerarGrade() {
    setGerando(true)
    try {
      const res = await fetch("/api/ia/gerar-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Erro ao gerar grade")

      const extra =
        payload.resumoTurnos || payload.resumo
          ? `\n\n${payload.resumoTurnos || payload.resumo}`
          : ""
      const avisos =
        Array.isArray(payload.avisos) && payload.avisos.length
          ? `\n\nAvisos: ${payload.avisos.join(" ")}`
          : ""
      alert((payload.mensagem || "Grade salva!") + extra + avisos)
      await carregar()
      const temTarde = turmas.some((t) => normalizarTurnoTurma(t.periodo) === "tarde")
      if (temTarde) setTurnoAtivo("tarde")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar grade.")
    }
    setGerando(false)
  }

  async function handleRemover() {
    if (!confirm("Limpar a grade de todas as salas e turnos?")) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("grade_horarios").delete().eq("escola_id", userData.user.id)
    carregar()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar className="h-7 w-7" style={{ color: "var(--aria-accent)" }} />
            Grade Horária
          </h1>
          <p className="page-subtitle">
            Separada por turno: <strong>matutino</strong> e <strong>vespertino</strong> não se misturam.
            Um professor só leciona em uma turma por horário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleRemover}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
          <Button onClick={handleGerarGrade} disabled={gerando || !turmas.length}>
            <Sparkles className="h-4 w-4 mr-1" />
            {gerando ? "Gerando..." : "Gerar grade (todos os turnos)"}
          </Button>
        </div>
      </div>

      {turnosDisponiveis.length > 1 && (
        <div
          className="flex flex-wrap gap-2 p-1.5 rounded-[var(--aria-radius-lg)] border"
          style={{ borderColor: "var(--aria-border)", background: "var(--aria-surface)" }}
          role="tablist"
          aria-label="Turno da grade"
        >
          {turnosDisponiveis.map((turno) => {
            const ativo = turnoAtivo === turno
            const qtd = filtrarTurmasPorTurno(turmas, turno).length
            return (
              <button
                key={turno}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setTurnoAtivo(turno)}
                className="flex items-center gap-2 rounded-[var(--aria-radius)] px-4 py-2.5 text-sm font-medium transition-all"
                style={
                  ativo
                    ? {
                        background: "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(99,102,241,0.25))",
                        color: "var(--aria-text)",
                        boxShadow: "0 0 0 1px rgba(34,211,238,0.35)",
                      }
                    : { color: "var(--aria-text-muted)" }
                }
              >
                {iconeTurno(turno)}
                {LABEL_TURNO[turno]}
                <span
                  className="rounded-full px-2 py-0.5 text-xs"
                  style={{
                    background: ativo ? "var(--aria-accent-soft)" : "rgba(255,255,255,0.06)",
                  }}
                >
                  {qtd}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{resumoTurno(turnoAtivo, turmas, periodosAula)}</Badge>
        <Badge variant="outline">{LABEL_TURNO_CURTO[turnoAtivo]}</Badge>
        <Badge variant="default">{gradeTurno.length} aulas neste turno</Badge>
      </div>

      {validacao && (
        <div
          className="flex items-start gap-3 rounded-[var(--aria-radius-lg)] border px-4 py-3 text-sm"
          style={{
            borderColor: validacao.ok ? "rgba(34,211,238,0.25)" : "rgba(239,68,68,0.35)",
            backgroundColor: validacao.ok ? "var(--aria-accent-soft)" : "rgba(239,68,68,0.08)",
          }}
        >
          {validacao.ok ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-400" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <div>
            {validacao.ok ? (
              <p style={{ color: "var(--aria-text)" }}>
                Turno {LABEL_TURNO[turnoAtivo].toLowerCase()}: grade válida neste horário.
              </p>
            ) : (
              <>
                <p className="font-medium text-red-300">Atenção no turno {LABEL_TURNO[turnoAtivo]}</p>
                <ul className="mt-1 list-disc pl-4" style={{ color: "var(--aria-text-muted)" }}>
                  {[...validacao.conflitos, ...validacao.sequenciasLongas].map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {turmas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center" style={{ color: "var(--aria-text-muted)" }}>
            Cadastre {rotuloSalas.toLowerCase()} e períodos em Horários antes de gerar a grade.
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-5xl mx-auto w-full">
          <GradeVertical
            turmas={turmasTurno}
            periodosAula={periodosTurno}
            grade={gradeTurno}
            rotuloSalas={rotuloSalas}
          />
        </div>
      )}

      {turnoAtivo === "tarde" && periodosTurno.length === 0 && (
        <p className="text-xs text-center" style={{ color: "var(--aria-text-subtle)" }}>
          Dica: cadastre períodos de aula com horário de início a partir de 12:00 em{" "}
          <strong>Horários</strong> para o turno vespertino.
        </p>
      )}
    </div>
  )
}