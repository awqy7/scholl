"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Loading, EmptyState } from "@/components/shared/loading"
import { DIAS_SEMANA } from "@/lib/utils"
import { ClipboardList, Plus, Brain } from "lucide-react"
import { useToast } from "@/components/shared/toast"
import type { PlanejamentoSemanal, Turma, Materia, Professor } from "@/types/database"

export default function PlanejamentoPage() {
  return (
    <AppShell>
      <PlanejamentoContent />
    </AppShell>
  )
}

function PlanejamentoContent() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [planejamentos, setPlanejamentos] = useState<PlanejamentoSemanal[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [turmaId, setTurmaId] = useState("")
  const [form, setForm] = useState({
    turma_id: "", materia_id: "", professor_id: "",
    conteudo: "", objetivos: "",
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const [pRes, tRes, mRes, prRes] = await Promise.all([
      supabase.from("planejamento_semanal").select("*, turma:turmas(*), materia:materias(*), professor:professores(*)").eq("escola_id", eId).order("semana_inicio", { ascending: false }),
      supabase.from("turmas").select("*").eq("escola_id", eId),
      supabase.from("materias").select("*").eq("escola_id", eId),
      supabase.from("professores").select("*").eq("escola_id", eId),
    ])
    if (pRes.data) setPlanejamentos(pRes.data)
    if (tRes.data) setTurmas(tRes.data)
    if (mRes.data) setMaterias(mRes.data)
    if (prRes.data) setProfessores(prRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const hoje = new Date()
    const diaSemana = hoje.getDay()
    const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1)
    const segunda = new Date(hoje.setDate(diff))

    const { error } = await supabase.from("planejamento_semanal").insert({
      escola_id: eId,
      semana_inicio: segunda.toISOString().split("T")[0],
      ...form,
    })
    if (error) {
      showToast("Erro ao salvar planejamento", "error")
      return
    }
    showToast("Planejamento salvo!", "success")
    setShowForm(false)
    setForm({ turma_id: "", materia_id: "", professor_id: "", conteudo: "", objetivos: "" })
    carregar()
  }

  const turmasMap = new Map(turmas.map((t) => [t.id, t.nome]))
  const materiasMap = new Map(materias.map((m) => [m.id, m.nome]))
  const professoresMap = new Map(professores.map((p) => [p.id, p.nome]))

  const planosFiltrados = turmaId
    ? planejamentos.filter((p) => p.turma_id === turmaId)
    : planejamentos

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Planejamento Semanal</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("aria:abrir-chat"))}
            title="Peça à ARIA para analisar o planejamento e sugerir melhorias"
          >
            <Brain className="h-4 w-4 mr-2" /> Analisar com ARIA
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Planejamento
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Label>Filtrar por turma:</Label>
        <Select value={turmaId} onChange={(e) => setTurmaId(e.target.value)} className="w-64">
          <option value="">Todas as turmas</option>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </Select>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Novo Planejamento</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Turma</Label>
                  <Select value={form.turma_id} onChange={(e) => setForm({ ...form, turma_id: e.target.value })} required>
                    <option value="">Selecionar...</option>
                    {turmas.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Matéria</Label>
                  <Select value={form.materia_id} onChange={(e) => setForm({ ...form, materia_id: e.target.value })} required>
                    <option value="">Selecionar...</option>
                    {materias.map((m) => (<option key={m.id} value={m.id}>{m.nome}</option>))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Professor</Label>
                  <Select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} required>
                    <option value="">Selecionar...</option>
                    {professores.map((p) => (<option key={p.id} value={p.id}>{p.nome}</option>))}
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <textarea
                  className="field-base flex h-20 resize-y"
                  value={form.conteudo}
                  onChange={(e) => setForm({ ...form, conteudo: e.target.value })}
                  placeholder="Descreva o conteúdo da semana"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Objetivos</Label>
                <textarea
                  className="field-base flex h-20 resize-y"
                  value={form.objetivos}
                  onChange={(e) => setForm({ ...form, objetivos: e.target.value })}
                  placeholder="Objetivos de aprendizagem"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit">Salvar</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {planosFiltrados.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-12 w-12" />} title="Nenhum planejamento" description="Crie planejamentos semanais para cada turma" />
          ) : (
            <div className="divide-y">
              {planosFiltrados.map((p) => (
                <div key={p.id} className="p-4 hover:bg-[var(--aria-surface-hover)]" style={{ background: "var(--aria-surface)" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{materiasMap.get(p.materia_id)}</p>
                      <p className="text-sm" style={{ color: "var(--aria-text-muted)" }}>
                        {turmasMap.get(p.turma_id)} - {professoresMap.get(p.professor_id)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">Semana: {p.semana_inicio}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-700">
                    <p><strong>Conteúdo:</strong> {p.conteudo}</p>
                    {p.objetivos && <p className="mt-1"><strong>Objetivos:</strong> {p.objetivos}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
