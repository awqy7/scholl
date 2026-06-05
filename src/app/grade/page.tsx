"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loading } from "@/components/shared/loading"
import { DIAS_SEMANA } from "@/lib/utils"
import { persistGradeHorarios } from "@/lib/persist-ia"
import { Calendar, Sparkles, Trash2 } from "lucide-react"
import type { GradeHorario, Turma, Materia, Professor, Periodo } from "@/types/database"

export default function GradePage() {
  return (
    <AppShell>
      <GradeContent />
    </AppShell>
  )
}

function GradeContent() {
  const supabase = createClient()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [grade, setGrade] = useState<GradeHorario[]>([])
  const [loading, setLoading] = useState(true)
  const [turmaId, setTurmaId] = useState("")
  const [gerando, setGerando] = useState(false)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const eId = userData.user.id

    const [tRes, mRes, pRes, perRes, gRes] = await Promise.all([
      supabase.from("turmas").select("*").eq("escola_id", eId),
      supabase.from("materias").select("*").eq("escola_id", eId),
      supabase.from("professores").select("*").eq("escola_id", eId),
      supabase.from("periodos").select("*").eq("escola_id", eId).order("ordem"),
      supabase.from("grade_horarios").select("*, materia:materias(*), professor:professores(*), periodo:periodos(*)").eq("escola_id", eId),
    ])
    if (tRes.data) setTurmas(tRes.data)
    if (mRes.data) setMaterias(mRes.data)
    if (pRes.data) setProfessores(pRes.data)
    if (perRes.data) setPeriodos(perRes.data)
    if (gRes.data) setGrade(gRes.data)
    if (tRes.data?.length) setTurmaId(tRes.data[0].id)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleGerarGrade() {
    setGerando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Não autenticado")

      const res = await fetch("/api/ia/gerar-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turmas, materias, professores, periodos,
          gradeAtual: grade,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Erro ao gerar grade")

      const resultado = await persistGradeHorarios(
        supabase,
        userData.user.id,
        payload,
        turmas.map((t) => ({ id: t.id, nome: t.nome })),
        materias.map((m) => ({ id: m.id, nome: m.nome })),
        professores.map((p) => ({ id: p.id, nome: p.nome })),
        periodos.map((p) => ({ id: p.id, nome: p.nome }))
      )
      if (!resultado.ok) throw new Error(resultado.mensagem)
      alert(resultado.mensagem)
      carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar grade. Verifique a chave da IA.")
    }
    setGerando(false)
  }

  async function handleRemover() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("grade_horarios").delete().eq("escola_id", userData.user.id)
    carregar()
  }

  const gradeFiltrada = grade.filter((g) => !turmaId || g.turma_id === turmaId)

  function getCelula(dia: number, periodoId: string) {
    return gradeFiltrada.find((g) => g.dia_semana === dia && g.periodo_id === periodoId)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grade Horária</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRemover}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar Grade
          </Button>
          <Button onClick={handleGerarGrade} disabled={gerando}>
            <Sparkles className="h-4 w-4 mr-1" />
            {gerando ? "Gerando..." : "Gerar com IA"}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Label>Turma:</Label>
        <Select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className="w-64">
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome} ({t.periodo})</option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left font-medium text-gray-500 w-24">Horário</th>
                {DIAS_SEMANA.map((d) => (
                  <th key={d} className="p-2 text-center font-medium text-gray-500 min-w-[120px]">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodos.map((per) => (
                <tr key={per.id} className="border-t">
                  <td className="p-2 text-gray-500 font-medium">
                    <div>{per.nome}</div>
                    <div className="text-xs">{per.hora_inicio}-{per.hora_fim}</div>
                  </td>
                  {[0, 1, 2, 3, 4].map((dia) => {
                    const celula = getCelula(dia, per.id)
                    return (
                      <td key={dia} className="p-1 border-l">
                        {celula ? (
                          <div
                            className="rounded-lg p-2 text-xs"
                            style={{ backgroundColor: celula.materia?.cor + "20", borderLeft: `3px solid ${celula.materia?.cor}` }}
                          >
                            <div className="font-medium">{celula.materia?.nome}</div>
                            <div className="text-gray-500">{celula.professor?.nome}</div>
                          </div>
                        ) : (
                          <div className="h-14" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
