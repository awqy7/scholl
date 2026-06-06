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
import { formatDate } from "@/lib/utils"
import { Plus, UserX, Brain } from "lucide-react"
import { useToast } from "@/components/shared/toast"
import { useEscolaId } from "@/lib/useEscolaData"
import { z } from "zod"

const faltaSchema = z.object({
  professor_id: z.string().min(1, "Selecione um professor"),
  motivo: z.string().min(3, "Motivo deve ter pelo menos 3 caracteres"),
  status: z.enum(["justificada", "injustificada"]),
})
import { MOTIVOS_FALTA } from "@/lib/constants"
import type { Falta, Professor } from "@/types/database"

export default function FaltasPage() {
  return (
    <AppShell>
      <FaltasContent />
    </AppShell>
  )
}

function FaltasContent() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    professor_id: "", motivo: "Atestado médico", status: "justificada" as const,
  })

  // Para creche e interligação: turmas afetadas + substitutos sugeridos
  const [affectedTurmas, setAffectedTurmas] = useState<any[]>([])
  const [suggestedSubs, setSuggestedSubs] = useState<any[]>([])
  const [selectedSub, setSelectedSub] = useState("")

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const [fRes, pRes] = await Promise.all([
      supabase.from("faltas").select("*, professor:professores(*)").eq("escola_id", eId).order("data", { ascending: false }),
      supabase.from("professores").select("*").eq("escola_id", eId),
    ])
    if (fRes.data) setFaltas(fRes.data)
    if (pRes.data) setProfessores(pRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function loadSuggestionsForFalta(profId: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    // Turmas onde este professor é o padrão (afeta diretamente)
    const { data: aff } = await supabase
      .from("turmas")
      .select("id, nome")
      .eq("escola_id", eId)
      .eq("professor_responsavel_id", profId)
    setAffectedTurmas(aff || [])

    // Professores disponíveis (presentes, diferentes do que faltou)
    const { data: avail } = await supabase
      .from("professores")
      .select("id, nome")
      .eq("escola_id", eId)
      .eq("status", "presente")
      .neq("id", profId)

    let subs = avail || []

    if (aff && aff.length > 0) {
      const affectedIds = aff.map((t: any) => t.id)
      // Quais destes disponíveis são padrão de alguma das turmas afetadas?
      const { data: covering } = await supabase
        .from("turmas")
        .select("professor_responsavel_id")
        .in("id", affectedIds)
        .not("professor_responsavel_id", "is", null)
      const prio = new Set((covering || []).map((c: any) => c.professor_responsavel_id))
      subs = subs.sort((a: any, b: any) => {
        const aP = prio.has(a.id) ? 1 : 0
        const bP = prio.has(b.id) ? 1 : 0
        return bP - aP
      })
    }

    // Sort already done prioritizing padrões das turmas afetadas
    setSuggestedSubs(subs)
    if (subs.length > 0) setSelectedSub(subs[0].id)
  }

  // Carrega turmas afetadas e substitutos sugeridos quando o professor da falta muda
  useEffect(() => {
    if (form.professor_id) {
      loadSuggestionsForFalta(form.professor_id)
    } else {
      setAffectedTurmas([])
      setSuggestedSubs([])
      setSelectedSub("")
    }
  }, [form.professor_id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const parsed = faltaSchema.safeParse(form)
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Dados inválidos", "error")
      return
    }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    // Inserir falta e obter o id para linkar com substituição
    const { data: newFalta, error } = await supabase.from("faltas").insert({
      escola_id: eId,
      professor_id: parsed.data.professor_id,
      data: new Date().toISOString().split("T")[0],
      motivo: parsed.data.motivo,
      status: parsed.data.status,
    }).select().single()

    if (!error && newFalta) {
      const prof = professores.find((p) => p.id === parsed.data.professor_id)
      await supabase.from("professores").update({ status: "ausente" }).eq("id", parsed.data.professor_id)
      await supabase.from("eventos_tempo_real").insert({
        escola_id: eId,
        tipo: "falta",
        mensagem: `${prof?.nome} registrou falta - ${parsed.data.motivo}`,
        professor_id: parsed.data.professor_id,
      })

      // Se o usuário escolheu um substituto sugerido, cria a ligação automaticamente
      // (interligação forte entre Faltas ↔ Substituições ↔ Turmas com padrão)
      if (selectedSub) {
        await supabase.from("substituicoes").insert({
          escola_id: eId,
          falta_id: newFalta.id,
          professor_original_id: parsed.data.professor_id,
          professor_substituto_id: selectedSub,
          data: new Date().toISOString().split("T")[0],
          status: "pendente",
        })
        const subProf = professores.find((p) => p.id === selectedSub)
        await supabase.from("eventos_tempo_real").insert({
          escola_id: eId,
          tipo: "substituicao",
          mensagem: `Sugestão de cobertura: ${subProf?.nome} para ${prof?.nome}`,
          professor_id: selectedSub,
        })
      }

      showToast(selectedSub ? "Falta registrada + substituição sugerida criada automaticamente (interligada com as turmas afetadas)!" : "Falta registrada.", "success")
      carregar()
    } else {
      showToast("Erro ao registrar falta.", "error")
    }
    setShowForm(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Faltas</h1>
          <p className="text-xs opacity-60">Versão legada. Use <a href="/ausencias" className="underline">Ausências</a> para o fluxo completo com sugestões automáticas baseadas em padrões das salas + impacto no recreio.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("aria:abrir-chat"))}
          >
            <Brain className="h-4 w-4 mr-2" /> Pedir análise / sugestão com ARIA
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar Falta
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Registrar Falta</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} required>
                  <option value="">Selecionar...</option>
                  {professores.filter((p) => p.status === "presente").map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                  {MOTIVOS_FALTA.map((m) => (<option key={m} value={m}>{m}</option>))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="justificada">Justificada</option>
                  <option value="injustificada">Injustificada</option>
                </Select>
              </div>

              {/* Interligação com turmas: mostra impacto e sugere cobertura automaticamente */}
              {form.professor_id && (affectedTurmas.length > 0 || suggestedSubs.length > 0) && (
                <div className="space-y-3 border-t pt-3 text-sm">
                  {affectedTurmas.length > 0 && (
                    <div>
                      <Label className="text-xs">Turmas que ficarão sem o responsável padrão hoje (este professor é o padrão delas):</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {affectedTurmas.map((t: any) => <Badge key={t.id} variant="warning">{t.nome}</Badge>)}
                      </div>
                    </div>
                  )}

                  {suggestedSubs.length > 0 && (
                    <div>
                      <Label>Substituto sugerido (o sistema prioriza quem já é padrão destas turmas)</Label>
                      <Select value={selectedSub} onChange={(e) => setSelectedSub(e.target.value)}>
                        <option value="">— escolher depois —</option>
                        {suggestedSubs.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </Select>
                      <p className="text-[10px] text-emerald-600 mt-0.5">Sugestão automática baseada nas salas afetadas e disponibilidade atual.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit">Registrar</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {faltas.length === 0 ? (
            <EmptyState icon={<UserX className="h-12 w-12" />} title="Nenhuma falta registrada" description="Registre faltas para ativar substituições automáticas" />
          ) : (
            <div className="divide-y">
              {faltas.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-4 hover:bg-[var(--aria-surface-hover)]" style={{ background: "var(--aria-surface)" }}>
                  <div>
                    <p className="font-medium">{f.professor?.nome}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={f.status === "justificada" ? "success" : "danger"}>{f.status}</Badge>
                      <span className="text-sm text-gray-500">{f.motivo}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{formatDate(f.data)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
