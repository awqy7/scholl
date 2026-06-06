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
import { Plus, UserX, RefreshCw, Brain, Trash2, Check, X } from "lucide-react"
import { useToast } from "@/components/shared/toast"
import { useEscolaId } from "@/lib/useEscolaData"
import { z } from "zod"
import { MOTIVOS_FALTA } from "@/lib/constants"
import Link from "next/link"
import type { Falta, Professor, Substituicao, Monitor } from "@/types/database"
import { DIAS_SEMANA } from "@/lib/utils"

const faltaSchema = z.object({
  professor_id: z.string().min(1),
  motivo: z.string().min(3),
  status: z.enum(["justificada", "injustificada"]),
})

export default function AusenciasPage() {
  return (
    <AppShell>
      <AusenciasContent />
    </AppShell>
  )
}

type Tab = "faltas" | "substituicoes"

function AusenciasContent() {
  const [activeTab, setActiveTab] = useState<Tab>("faltas")

  const tabs = [
    { key: "faltas" as const, label: "Faltas", icon: UserX, desc: "Registre quando um professor falta" },
    { key: "substituicoes" as const, label: "Substituições", icon: RefreshCw, desc: "Gerencie quem cobre a falta" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ausências e Cobertura</h1>
        <p className="text-sm mt-1 opacity-70">Tudo sobre faltas e quem substitui em um único lugar. Fluxo simples e rápido.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: "var(--aria-border)" }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                active ? "bg-amber-500/15 text-amber-200 border border-amber-500/30" : "hover:bg-white/5 text-white/70"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === "faltas" && <FaltasTab />}
      {activeTab === "substituicoes" && <SubstituicoesTab />}
    </div>
  )
}

// ==================== FALTAS (versão profunda interligada com Turmas + Padrões + Recreio) ====================
function FaltasTab() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [monitores, setMonitores] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form estendido para creche (prof ou monitor)
  const [ausenteTipo, setAusenteTipo] = useState<"professor" | "monitor">("professor")
  const [ausenteId, setAusenteId] = useState("")
  const [motivo, setMotivo] = useState("Atestado médico")
  const [status, setStatus] = useState<"justificada" | "injustificada">("justificada")

  // Interligação profunda
  const [affectedTurmas, setAffectedTurmas] = useState<any[]>([])
  const [recreioImpact, setRecreioImpact] = useState<any[]>([]) // slots + turmas no recreio de hoje
  const [suggestedSubs, setSuggestedSubs] = useState<any[]>([])
  const [selectedSub, setSelectedSub] = useState("")

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const [fRes, pRes, mRes] = await Promise.all([
      supabase.from("faltas").select("*, professor:professores(*)").eq("escola_id", eId).order("data", { ascending: false }).limit(30),
      supabase.from("professores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("monitores").select("*").eq("escola_id", eId).order("nome"),
    ])
    if (fRes.data) setFaltas(fRes.data as any)
    if (pRes.data) setProfessores(pRes.data as any)
    if (mRes.data) setMonitores(mRes.data as any)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  // Função central: ao escolher o ausente (prof ou monitor), calcula tudo que conversa com o sistema
  async function loadInterlinkedData(personId: string, tipo: "professor" | "monitor") {
    if (!personId) {
      setAffectedTurmas([]); setRecreioImpact([]); setSuggestedSubs([]); setSelectedSub("")
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    // 1. Turmas afetadas (onde ele/ela é o PADRÃO)
    const col = tipo === "professor" ? "professor_responsavel_id" : "monitor_responsavel_id"
    const { data: aff } = await supabase
      .from("turmas")
      .select("id, nome")
      .eq("escola_id", eId)
      .eq(col, personId)
    const affTurmas = aff || []
    setAffectedTurmas(affTurmas)

    // 2. Impacto no recreio escalonado de HOJE (dia atual mapeado para 0-4)
    const hoje = new Date()
    const jsDay = hoje.getDay() // 0=dom ... 6=sab
    const diaSemana = (jsDay + 6) % 7   // 0=seg ... 5=dom (limitamos visualmente a 0-4)
    const safeDia = Math.min(diaSemana, 4)

    const field = tipo === "professor" ? "professor_id" : "monitor_id"
    const { data: recImp } = await supabase
      .from("recreio_supervisao")
      .select(`id, turma:turmas(nome), periodo:periodos(nome, hora_inicio, hora_fim)`)
      .eq("escola_id", eId)
      .eq("dia_semana", safeDia)
      .eq(field, personId)
    setRecreioImpact(recImp || [])

    // 3. Sugestões de substitutos priorizando quem é PADRÃO das turmas afetadas + presentes
    const table = tipo === "professor" ? "professores" : "monitores"
    const { data: avail } = await supabase
      .from(table as any)
      .select("id, nome, status")
      .eq("escola_id", eId)
      .neq("id", personId)

    let candidates = (avail || []).filter((p: any) => !p.status || p.status === "presente")

    if (affTurmas.length > 0) {
      const affectedIds = affTurmas.map((t: any) => t.id)
      // Quem é padrão de alguma das afetadas?
      const { data: covering } = await supabase
        .from("turmas")
        .select(col)
        .in("id", affectedIds)
        .not(col, "is", null)
      const prio = new Set((covering || []).map((c: any) => c[col]))
      candidates = candidates.sort((a: any, b: any) => {
        const aP = prio.has(a.id) ? 1 : 0
        const bP = prio.has(b.id) ? 1 : 0
        return bP - aP
      })
    }

    setSuggestedSubs(candidates)
    if (candidates.length > 0) setSelectedSub(candidates[0].id)
    else setSelectedSub("")
  }

  // Reage a mudanças de tipo + ausente
  useEffect(() => {
    if (ausenteId) loadInterlinkedData(ausenteId, ausenteTipo)
    else {
      setAffectedTurmas([]); setRecreioImpact([]); setSuggestedSubs([]); setSelectedSub("")
    }
  }, [ausenteId, ausenteTipo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ausenteId) { showToast("Selecione quem está ausente", "error"); return }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const hojeStr = new Date().toISOString().split("T")[0]
    const pessoaNome = (ausenteTipo === "professor"
      ? professores.find(p => p.id === ausenteId)?.nome
      : monitores.find(m => m.id === ausenteId)?.nome) || "Pessoa"

    let faltaId: string | null = null

    if (ausenteTipo === "professor") {
      // Fluxo completo para professor (tabela suporta)
      const { data: newFalta, error } = await supabase.from("faltas").insert({
        escola_id: eId,
        professor_id: ausenteId,
        data: hojeStr,
        motivo,
        status,
      }).select().single()

      if (error) { showToast("Erro ao registrar falta: " + error.message, "error"); return }
      faltaId = newFalta.id

      await supabase.from("professores").update({ status: "ausente" }).eq("id", ausenteId)

      await supabase.from("eventos_tempo_real").insert({
        escola_id: eId,
        tipo: "falta",
        mensagem: `${pessoaNome} (padrão de ${affectedTurmas.length} sala(s)) registrou falta — ${motivo}`,
        professor_id: ausenteId,
      })

      if (selectedSub) {
        await supabase.from("substituicoes").insert({
          escola_id: eId,
          falta_id: faltaId,
          professor_original_id: ausenteId,
          professor_substituto_id: selectedSub,
          data: hojeStr,
          status: "pendente",
        })
        const subNome = professores.find(p => p.id === selectedSub)?.nome
        await supabase.from("eventos_tempo_real").insert({
          escola_id: eId,
          tipo: "substituicao",
          mensagem: `Cobertura sugerida: ${subNome} → ${pessoaNome} (afeta: ${affectedTurmas.map(t=>t.nome).join(", ") || "—"}${recreioImpact.length ? " + recreio" : ""})`,
          professor_id: selectedSub,
        })
      }
    } else {
      // Monitor: sem falta na tabela (schema), mas cobertura total via evento + aplicação direta no recreio
      await supabase.from("eventos_tempo_real").insert({
        escola_id: eId,
        tipo: "falta",
        mensagem: `Monitor ${pessoaNome} ausente (padrão de ${affectedTurmas.length} sala(s)) — ${motivo}. Impacto recreio: ${recreioImpact.length} slot(s)`,
      })
    }

    const msg = selectedSub
      ? (ausenteTipo === "professor"
          ? "Falta + substituição criada automaticamente (interligada com turmas e recreio)"
          : "Ausência de monitor registrada. Use 'Aplicar cobertura no recreio' para substituir nos horários de hoje.")
      : "Ausência registrada."

    showToast(msg, "success")

    // Se temos substituto e há impacto no recreio, oferecemos aplicação automática (botão abaixo também)
    if (selectedSub && recreioImpact.length > 0 && ausenteTipo === "professor") {
      // Auto-aplicar cobertura nos slots do recreio de hoje para este ausente (professor)
      await aplicarCoberturaNoRecreio(ausenteId, ausenteTipo, selectedSub)
    }

    // Reset + recarregar tudo
    setShowForm(false)
    setAusenteId(""); setSelectedSub(""); setAffectedTurmas([]); setRecreioImpact([]); setSuggestedSubs([])
    carregar()
  }

  // Aplica o substituto escolhido diretamente nos registros de recreio_supervisao de hoje para as turmas afetadas
  async function aplicarCoberturaNoRecreio(absentId: string, tipo: "professor" | "monitor", subId: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const hoje = new Date()
    const jsDay = hoje.getDay()
    const diaSemana = Math.min((jsDay + 6) % 7, 4)

    const field = tipo === "professor" ? "professor_id" : "monitor_id"

    const { data: slotsAfetados } = await supabase
      .from("recreio_supervisao")
      .select("id, turma:turmas(nome)")
      .eq("escola_id", eId)
      .eq("dia_semana", diaSemana)
      .eq(field, absentId)

    if (!slotsAfetados || slotsAfetados.length === 0) {
      showToast("Nenhum slot de recreio para atualizar (ou já atualizado).", "info")
      return
    }

    const updates = slotsAfetados.map((s: any) => supabase.from("recreio_supervisao").update({ [field]: subId }).eq("id", s.id))
    await Promise.all(updates)

    const nomes = slotsAfetados.map((s: any) => s.turma?.nome).filter(Boolean).join(", ")
    showToast(`Cobertura aplicada no recreio de hoje para: ${nomes}`, "success")

    // Dispara recarregamento em outras páginas abertas via storage event ou simplesmente avisa
    window.dispatchEvent(new CustomEvent("rotina:reload"))
  }

  async function handleDelete(id: string) {
    await supabase.from("faltas").delete().eq("id", id)
    showToast("Falta removida", "success")
    carregar()
  }

  const listaAusentes = ausenteTipo === "professor" ? professores : monitores

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="font-medium flex items-center gap-2"><UserX className="h-5 w-5" /> Registrar Ausência (interligada)</div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> Registrar Ausência</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <div className="text-xs opacity-70">O sistema reconhece automaticamente as turmas onde esta pessoa é o PADRÃO e sugere quem já é padrão daquelas mesmas salas. Para creche, monitores também são suportados (aplicação direta no recreio escalonado).</div>

            {/* Tipo de ausente - chave para creche */}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAusenteTipo("professor"); setAusenteId(""); setSelectedSub("") }}
                className={`px-3 py-1 rounded text-sm border ${ausenteTipo === "professor" ? "bg-blue-500/20 border-blue-400" : "border-white/20 hover:bg-white/5"}`}>
                Professor / Educador Infantil
              </button>
              <button type="button" onClick={() => { setAusenteTipo("monitor"); setAusenteId(""); setSelectedSub("") }}
                className={`px-3 py-1 rounded text-sm border ${ausenteTipo === "monitor" ? "bg-blue-500/20 border-blue-400" : "border-white/20 hover:bg-white/5"}`}>
                Monitor / Auxiliar (creche)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="md:col-span-2">
                <Label>{ausenteTipo === "professor" ? "Professor / Educador que falta" : "Monitor que falta"}</Label>
                <Select value={ausenteId} onChange={e => setAusenteId(e.target.value)} required>
                  <option value="">Selecione...</option>
                  {listaAusentes.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nome}{p.status && p.status !== "presente" ? ` (${p.status})` : ""}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label>Motivo</Label>
                <Select value={motivo} onChange={e => setMotivo(e.target.value)}>
                  {MOTIVOS_FALTA.map(m => <option key={m} value={m}>{m}</option>)}
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onChange={e => setStatus(e.target.value as any)}>
                  <option value="justificada">Justificada</option>
                  <option value="injustificada">Injustificada</option>
                </Select>
              </div>

              {/* Painel de interligação profunda (o coração do "vai mais fundo") */}
              {ausenteId && (affectedTurmas.length > 0 || recreioImpact.length > 0 || suggestedSubs.length > 0) && (
                <div className="md:col-span-2 space-y-3 border-t pt-3">
                  {affectedTurmas.length > 0 && (
                    <div>
                      <Label className="text-xs">Turmas que ficarão sem o responsável PADRÃO:</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {affectedTurmas.map((t: any) => <Badge key={t.id} variant="warning">{t.nome}</Badge>)}
                      </div>
                    </div>
                  )}

                  {recreioImpact.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2">
                      <Label className="text-xs text-amber-300">Impacto no Recreio Escalonado de hoje ({recreioImpact.length} slot(s))</Label>
                      <div className="text-xs mt-1 space-y-0.5">
                        {recreioImpact.map((imp: any, i: number) => (
                          <div key={i}>• {imp.periodo?.hora_inicio}–{imp.periodo?.hora_fim} — {imp.turma?.nome}</div>
                        ))}
                      </div>
                      <p className="text-[10px] mt-1 opacity-70">Se escolher substituto abaixo, o sistema pode aplicar a troca automaticamente nos horários de recreio.</p>
                    </div>
                  )}

                  {suggestedSubs.length > 0 && (
                    <div>
                      <Label>Substituto sugerido (prioriza quem já é padrão destas mesmas turmas)</Label>
                      <Select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}>
                        <option value="">— escolher depois —</option>
                        {suggestedSubs.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                      </Select>
                      <p className="text-[10px] text-emerald-400 mt-0.5">Sugestão automática baseada nas Salas + disponibilidade + padrões existentes.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">Registrar Ausência + Gerar Cobertura</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setAusenteId(""); setAffectedTurmas([]); setRecreioImpact([]) }}>Cancelar</Button>
              </div>
            </form>

            {/* Ação extra: aplicar cobertura manualmente mesmo depois */}
            {selectedSub && recreioImpact.length > 0 && (
              <div className="pt-2 border-t">
                <Button variant="secondary" size="sm" onClick={() => aplicarCoberturaNoRecreio(ausenteId, ausenteTipo, selectedSub)}>
                  Aplicar esta cobertura agora no recreio de hoje (todas as turmas afetadas)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {faltas.length === 0 ? (
        <EmptyState icon={<UserX className="h-10 w-10" />} title="Nenhuma falta registrada" description="Registre aqui que o sistema sugere cobertura priorizando os padrões das salas e atualiza o recreio automaticamente." />
      ) : (
        <div className="divide-y rounded border" style={{ borderColor: "var(--aria-border)" }}>
          {faltas.map(f => (
            <div key={f.id} className="flex justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{(f as any).professor?.nome}</div>
                <div className="text-xs opacity-70">{formatDate(f.data)} — {f.motivo}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={f.status === "justificada" ? "success" : "danger"}>{f.status}</Badge>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs opacity-60">Depois de registrar, a aba Substituições e o Recreio Escalonado (Rotina) já conversam com estes dados. Use o botão de cobertura acima para aplicar trocas diretamente nos horários de recreio.</div>

      {/* Visão profunda ao vivo: coberturas atuais no recreio de hoje (mostra que o sistema está conversando) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Coberturas ativas no recreio de hoje (prof + monitores)</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <CoberturasRecreioHoje />
        </CardContent>
      </Card>
    </div>
  )
}

// Componente extra para mostrar o estado real do recreio vs padrões (interligação visível)
function CoberturasRecreioHoje() {
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const hoje = new Date()
    const jsDay = hoje.getDay()
    const diaSemana = Math.min((jsDay + 6) % 7, 4)

    const [supRes, turmasRes] = await Promise.all([
      supabase.from("recreio_supervisao")
        .select(`id, turma_id, professor_id, monitor_id, turma:turmas(nome, professor_responsavel_id, monitor_responsavel_id), periodo:periodos(hora_inicio, hora_fim)`)
        .eq("escola_id", eId)
        .eq("dia_semana", diaSemana),
      supabase.from("turmas").select("id, nome, professor_responsavel_id, monitor_responsavel_id").eq("escola_id", eId)
    ])

    const turmasMap = new Map((turmasRes.data || []).map((t: any) => [t.id, t]))
    const result: any[] = []

    ;(supRes.data || []).forEach((s: any) => {
      const turma = turmasMap.get(s.turma_id) || s.turma
      const isProfSub = s.professor_id && turma?.professor_responsavel_id && s.professor_id !== turma.professor_responsavel_id
      const isMonSub = s.monitor_id && turma?.monitor_responsavel_id && s.monitor_id !== turma.monitor_responsavel_id
      if (isProfSub || isMonSub) {
        result.push({
          id: s.id,
          turmaNome: s.turma?.nome || turma?.nome,
          hora: `${s.periodo?.hora_inicio || ''}–${s.periodo?.hora_fim || ''}`,
          prof: isProfSub ? "prof substituto" : null,
          mon: isMonSub ? "monitor substituto" : null,
        })
      }
    })

    setItems(result)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return <div className="text-xs opacity-60">Carregando coberturas do recreio...</div>
  if (items.length === 0) return <div className="text-xs opacity-60">Nenhuma cobertura ativa no recreio de hoje (todos usando o padrão da sala).</div>

  return (
    <div className="space-y-1 text-xs">
      {items.map((it, idx) => (
        <div key={idx} className="flex gap-2">
          <span className="font-medium">{it.turmaNome}</span>
          <span className="opacity-70">{it.hora}</span>
          {it.prof && <Badge variant="warning">prof substituto</Badge>}
          {it.mon && <Badge variant="warning">monitor substituto</Badge>}
        </div>
      ))}
      <p className="text-[10px] opacity-60 mt-1">Isso reflete substituições aplicadas a partir de Ausências ou edições manuais na Rotina.</p>
    </div>
  )
}

// ==================== SUBSTITUIÇÕES ====================
function SubstituicoesTab() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [subs, setSubs] = useState<Substituicao[]>([])
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const [sRes, fRes, pRes] = await Promise.all([
      supabase.from("substituicoes").select("*, professor_original:professores!professor_original_id(*), professor_substituto:professores!professor_substituto_id(*)").eq("escola_id", eId).order("created_at", { ascending: false }),
      supabase.from("faltas").select("*, professor:professores(*)").eq("escola_id", eId).order("data", { ascending: false }),
      supabase.from("professores").select("*").eq("escola_id", eId),
    ])
    if (sRes.data) setSubs(sRes.data as any)
    if (fRes.data) setFaltas(fRes.data as any)
    if (pRes.data) setProfessores(pRes.data as any)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function criarSubstituicao(falta: Falta, substitutoId: string) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    await supabase.from("substituicoes").insert({
      escola_id: eId,
      falta_id: falta.id,
      professor_original_id: falta.professor_id,
      professor_substituto_id: substitutoId,
    })
    showToast("Substituição registrada", "success")
    carregar()
  }

  // Sugestão inteligente para uma falta específica (prioriza padrões das turmas que o original cobria)
  async function sugerirESubstituir(falta: Falta) {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    // Turmas onde o professor_original era padrão
    const { data: aff } = await supabase.from("turmas").select("id").eq("professor_responsavel_id", falta.professor_id)
    const affectedIds = (aff || []).map((t: any) => t.id)

    const { data: avail } = await supabase.from("professores").select("id, nome").eq("escola_id", eId).eq("status", "presente").neq("id", falta.professor_id)

    let subs = avail || []
    if (affectedIds.length > 0) {
      const { data: covering } = await supabase.from("turmas").select("professor_responsavel_id").in("id", affectedIds).not("professor_responsavel_id", "is", null)
      const prio = new Set((covering || []).map((c: any) => c.professor_responsavel_id))
      subs = subs.sort((a: any, b: any) => (prio.has(b.id) ? 1 : 0) - (prio.has(a.id) ? 1 : 0))
    }
    if (subs.length === 0) { showToast("Nenhum substituto disponível no momento.", "info"); return }

    // Usa o melhor
    const best = subs[0].id
    await criarSubstituicao(falta, best)
  }

  if (loading) return <Loading />

  const faltasSemSub = faltas.filter(f => !subs.some(s => s.falta_id === f.id))

  return (
    <div className="space-y-4">
      <div className="font-medium flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Substituições</div>

      {faltasSemSub.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Faltas sem cobertura</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {faltasSemSub.map(f => (
              <div key={f.id} className="flex items-center gap-3 p-2 border rounded">
                <div className="flex-1">{(f as any).professor?.nome} — {f.motivo}</div>
                <Button size="sm" variant="outline" onClick={() => sugerirESubstituir(f)}>Sugerir automático (padrões das salas)</Button>
                <Select onChange={e => criarSubstituicao(f, e.target.value)} className="w-40">
                  <option value="">Ou escolher...</option>
                  {professores.filter(p => p.id !== f.professor_id && p.status === "presente").map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {subs.length === 0 ? (
        <EmptyState icon={<RefreshCw className="h-10 w-10" />} title="Nenhuma substituição ainda" description="Registre faltas primeiro, depois defina quem vai cobrir aqui." />
      ) : (
        <div className="divide-y text-sm rounded border" style={{ borderColor: "var(--aria-border)" }}>
          {subs.map(s => (
            <div key={s.id} className="p-3 flex justify-between">
              <div>
                <div><span className="font-medium">{(s as any).professor_original?.nome}</span> → <span className="font-medium">{(s as any).professor_substituto?.nome}</span></div>
                <div className="text-xs opacity-70">{formatDate(s.data)}</div>
              </div>
              <Badge>{s.status}</Badge>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs opacity-60">Use o botão de cérebro na página de Professores ou Faltas para pedir sugestões de substituto à ARIA.</div>
    </div>
  )
}
