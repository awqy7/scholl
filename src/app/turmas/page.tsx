"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { Plus, Pencil, Trash2, Users, RefreshCw, Brain } from "lucide-react"
import Link from "next/link"
import type { Turma, Serie, Professor, Monitor } from "@/types/database"
import { useToast } from "@/components/shared/toast"
import { z } from "zod"

const turmaSchema = z.object({
  nome: z.string().min(2, "Nome da turma deve ter pelo menos 2 caracteres"),
  periodo: z.enum(["manha", "tarde", "integral"]),
  serie_id: z.string().optional(),
})

export default function TurmasPage() {
  return (
    <AppShell>
      <TurmasContent />
    </AppShell>
  )
}

function TurmasContent() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [series, setSeries] = useState<Serie[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [monitores, setMonitores] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [serieId, setSerieId] = useState("")
  const [periodo, setPeriodo] = useState("manha")
  const [professorRespId, setProfessorRespId] = useState("")
  const [monitorRespId, setMonitorRespId] = useState("")
  const [novaSerie, setNovaSerie] = useState("")
  const [search, setSearch] = useState("")

  // Para badges de ausência precisos (interligados com a tabela faltas de hoje)
  const [ausentesHojeProf, setAusentesHojeProf] = useState<Set<string>>(new Set())
  const [ausentesHojeMon, setAusentesHojeMon] = useState<Set<string>>(new Set())

  const filteredTurmas = turmas.filter((t) =>
    t.nome.toLowerCase().includes(search.toLowerCase())
  )

  // escolaId is resolved per operation via getUser() + legacy/membership support (see api-auth + migrations/00005)

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const hoje = new Date().toISOString().split("T")[0]

    const [turmasRes, seriesRes, profsRes, monRes, faltasRes] = await Promise.all([
      supabase.from("turmas").select("*, serie:series(*), professor_responsavel:professores!professor_responsavel_id(*), monitor_responsavel:monitores!monitor_responsavel_id(*)").eq("escola_id", eId),
      supabase.from("series").select("*").eq("escola_id", eId).order("ordem"),
      supabase.from("professores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("monitores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("faltas").select("professor_id").eq("escola_id", eId).eq("data", hoje),
    ])
    if (turmasRes.data) setTurmas(turmasRes.data as any)
    if (seriesRes.data) setSeries(seriesRes.data)
    if (profsRes.data) setProfessores(profsRes.data)
    if (monRes.data) setMonitores(monRes.data)

    // Badges precisos baseados em faltas reais de hoje (interligação forte)
    const profAusentes = new Set<string>()
    ;(faltasRes.data || []).forEach((f: any) => { if (f.professor_id) profAusentes.add(f.professor_id) })
    setAusentesHojeProf(profAusentes)
    // Para monitores ainda não temos tabela dedicada de faltas, então usamos o status como fallback (melhor que nada)
    const monAusentes = new Set<string>()
    monRes.data?.forEach((m: any) => { if (m.status && m.status !== "presente") monAusentes.add(m.id) })
    setAusentesHojeMon(monAusentes)

    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const onFocus = () => carregar()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const parsed = turmaSchema.safeParse({ nome, periodo, serie_id: serieId || undefined })
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Dados inválidos", "error")
      return
    }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const data = { 
      escola_id: eId, 
      nome: parsed.data.nome, 
      serie_id: parsed.data.serie_id || null, 
      periodo: parsed.data.periodo,
      professor_responsavel_id: professorRespId || null,
      monitor_responsavel_id: monitorRespId || null,
    }

    if (editingId) {
      const { error } = await supabase.from("turmas").update(data).eq("id", editingId)
      if (error) showToast("Erro ao atualizar: " + error.message, "error")
      else showToast("Turma atualizada!", "success")
    } else {
      const { error } = await supabase.from("turmas").insert(data)
      if (error) showToast("Erro ao criar: " + error.message, "error")
      else showToast("Turma criada!", "success")
    }

    resetForm()
    carregar()
  }

  async function handleDelete(id: string) {
    await supabase.from("turmas").delete().eq("id", id)
    carregar()
  }

  function editTurma(t: Turma) {
    setNome(t.nome)
    setSerieId(t.serie_id || "")
    setPeriodo(t.periodo)
    setProfessorRespId(t.professor_responsavel_id || "")
    setMonitorRespId(t.monitor_responsavel_id || "")
    setEditingId(t.id)
    setShowForm(true)
  }

  async function addSerie() {
    if (!novaSerie) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eIdForSerie = await getCurrentEscolaId(userData.user.id)
    await supabase.from("series").insert({
      escola_id: eIdForSerie,
      nome: novaSerie,
      ordem: series.length + 1,
    })
    setNovaSerie("")
    carregar()
  }

  function resetForm() {
    setNome("")
    setSerieId("")
    setPeriodo("manha")
    setProfessorRespId("")
    setMonitorRespId("")
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="page-title">Turmas</h1>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar turma..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("aria:abrir-chat"))}
          >
            <Brain className="h-4 w-4 mr-2" /> Análise com ARIA
          </Button>
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(!showForm) }}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancelar" : "Nova Turma"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Editar Turma" : "Nova Turma"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da Turma</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maternal A" required />
                </div>
                <div className="space-y-2">
                  <Label>Série</Label>
                  <div className="flex gap-2">
                    <Select value={serieId} onChange={(e) => setSerieId(e.target.value)} required>
                      <option value="">Selecionar...</option>
                      {series.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="integral">Integral</option>
                  </Select>
                </div>

                {/* Responsáveis padrão da sala - usado para automação no recreio escalonado */}
                <div className="space-y-2">
                  <Label>Professor responsável padrão da sala</Label>
                  <Select value={professorRespId} onChange={(e) => setProfessorRespId(e.target.value)}>
                    <option value="">(nenhum)</option>
                    {professores.map((p) => (
                      <option key={p.id} value={p.id}>{p.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monitor responsável padrão da sala (creche)</Label>
                  <Select value={monitorRespId} onChange={(e) => setMonitorRespId(e.target.value)}>
                    <option value="">(nenhum)</option>
                    {monitores.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </Select>
                  <p className="text-[10px] text-indigo-300/60">Este será usado automaticamente ao atribuir a turma no recreio.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? "Salvar" : "Criar Turma"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-indigo-500/20 pt-4">
              <Label className="mb-2 block">Adicionar nova série</Label>
              <div className="flex gap-2">
                <Input value={novaSerie} onChange={(e) => setNovaSerie(e.target.value)} placeholder="Ex: Jardim 3" />
                <Button type="button" variant="outline" onClick={addSerie}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {turmas.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="Nenhuma turma cadastrada"
              description="Crie sua primeira turma para começar"
            />
          ) : (
            <div className="divide-y">
              {filteredTurmas.map((turma) => (
                <div key={turma.id} className="flex items-center justify-between p-4 hover:bg-[var(--aria-surface-hover)]" style={{ background: "var(--aria-surface)" }}>
                  <div>
                    <p className="font-medium">{turma.nome}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{turma.serie?.nome}</Badge>
                      <Badge variant="default">{turma.periodo}</Badge>
                    </div>
                    {(turma.professor_responsavel || turma.monitor_responsavel) && (
                      <div className="text-xs text-emerald-300/70 mt-1">
                        Padrão: {turma.professor_responsavel?.nome || "—"} / {turma.monitor_responsavel?.nome || "—"}
                        {(!!turma.professor_responsavel_id && ausentesHojeProf.has(turma.professor_responsavel_id) || !!turma.monitor_responsavel_id && ausentesHojeMon.has(turma.monitor_responsavel_id)) && (
                          <span className="ml-1 text-red-400">(ausente hoje)</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => editTurma(turma)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(turma.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
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
