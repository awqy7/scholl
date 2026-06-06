"use client"

import { AppShell } from "@/components/layout/app-shell"
import { CrecheOnly } from "@/components/layout/creche-only"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { DIAS_SEMANA } from "@/lib/utils"
import { 
  Users, UserCheck, Clock, Plus, Trash2, Brain, TreePine, 
  AlertTriangle, CheckCircle2 
} from "lucide-react"
import { useToast } from "@/components/shared/toast"
import type { 
  Turma, Professor, Periodo, Monitor, 
  RecreioSupervisao, RecreioAtividade 
} from "@/types/database"

export default function RecreioPage() {
  return (
    <AppShell>
      <CrecheOnly>
        <RecreioContent />
      </CrecheOnly>
    </AppShell>
  )
}

type SupervisaoComAtividades = RecreioSupervisao & { atividades: RecreioAtividade[] }

function RecreioContent() {
  const supabase = createClient()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [escolaId, setEscolaId] = useState<string | null>(null)

  // Dados base
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [periodosRecreio, setPeriodosRecreio] = useState<Periodo[]>([]) // só tipo recreio
  const [monitores, setMonitores] = useState<Monitor[]>([])

  // Supervisões do dia selecionado (com atividades)
  const [supervisoes, setSupervisoes] = useState<SupervisaoComAtividades[]>([])

  // UI state
  const [diaSelecionado, setDiaSelecionado] = useState(1) // 0=dom ... 1=seg (padrão escola)
  const [showMonitores, setShowMonitores] = useState(false)
  const [novoMonitorNome, setNovoMonitorNome] = useState("")
  const [novoMonitorTel, setNovoMonitorTel] = useState("")

  // Formulário rápido de atribuição por slot
  const [atribuicao, setAtribuicao] = useState<Record<string, { turma_id: string; professor_id: string; monitor_id: string }>>({})

  const carregarTudo = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)
    setEscolaId(eId)

    const [
      tRes, pRes, profRes, monRes,
      supRes
    ] = await Promise.all([
      supabase.from("turmas")
        .select("*, serie:series(*), professor_responsavel:professores!professor_responsavel_id(*), monitor_responsavel:monitores!monitor_responsavel_id(*)")
        .eq("escola_id", eId)
        .order("nome"),
      supabase.from("periodos").select("*").eq("escola_id", eId).eq("tipo", "recreio").order("ordem"),
      supabase.from("professores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("monitores").select("*").eq("escola_id", eId).order("nome"),
      supabase
        .from("recreio_supervisao")
        .select(`
          *,
          turma:turmas(*),
          periodo:periodos(*),
          professor:professores(*),
          monitor:monitores(*)
        `)
        .eq("escola_id", eId)
        .eq("dia_semana", diaSelecionado)
    ])

    if (tRes.data) setTurmas(tRes.data as any)
    if (pRes.data) setPeriodosRecreio(pRes.data as any)
    if (profRes.data) setProfessores(profRes.data as any)
    if (monRes.data) setMonitores(monRes.data as any)

    // Carregar atividades para cada supervisão
    let supervisoesComAtiv: SupervisaoComAtividades[] = []
    if (supRes.data) {
      const sups = supRes.data as any[]
      const ids = sups.map(s => s.id)
      let ativMap = new Map<string, RecreioAtividade[]>()

      if (ids.length > 0) {
        const ativRes = await supabase
          .from("recreio_atividades")
          .select("*")
          .in("recreio_supervisao_id", ids)
          .order("ordem")
        if (ativRes.data) {
          for (const a of ativRes.data as RecreioAtividade[]) {
            if (!ativMap.has(a.recreio_supervisao_id)) ativMap.set(a.recreio_supervisao_id, [])
            ativMap.get(a.recreio_supervisao_id)!.push(a)
          }
        }
      }
      supervisoesComAtiv = sups.map(s => ({
        ...s,
        atividades: ativMap.get(s.id) || []
      })) as SupervisaoComAtividades[]
    }
    setSupervisoes(supervisoesComAtiv)

    setLoading(false)
  }, [supabase, diaSelecionado])

  useEffect(() => { carregarTudo() }, [carregarTudo])

  // Helpers para formulário de atribuição rápida
  function getAtribForm(periodoId: string) {
    return atribuicao[periodoId] || { turma_id: "", professor_id: "", monitor_id: "" }
  }
  function setAtribForm(periodoId: string, patch: Partial<{ turma_id: string; professor_id: string; monitor_id: string }>) {
    setAtribuicao(prev => ({
      ...prev,
      [periodoId]: { ...getAtribForm(periodoId), ...patch }
    }))
  }

  // ========== MONITORES ==========
  async function adicionarMonitor() {
    if (!escolaId || !novoMonitorNome.trim()) return
    const { error } = await supabase.from("monitores").insert({
      escola_id: escolaId,
      nome: novoMonitorNome.trim(),
      telefone: novoMonitorTel.trim() || null
    })
    if (error) {
      showToast("Erro ao adicionar monitor: " + error.message, "error")
      return
    }
    showToast("Monitor adicionado", "success")
    setNovoMonitorNome("")
    setNovoMonitorTel("")
    carregarTudo()
  }

  async function removerMonitor(id: string) {
    if (!confirm("Remover este monitor? As supervisões que usam ele ficarão sem monitor.")) return
    await supabase.from("monitores").delete().eq("id", id)
    showToast("Monitor removido", "success")
    carregarTudo()
  }

  // ========== ATRIBUIÇÃO DE SUPERVISÃO (TURMA + PROF + MONITOR NO SLOT) ==========
  async function atribuirTurmaAoSlot(periodo: Periodo) {
    if (!escolaId) return
    const form = getAtribForm(periodo.id)
    if (!form.turma_id) {
      showToast("Selecione uma turma", "error")
      return
    }

    // Evitar duplicata no mesmo (dia + periodo + turma) — o unique do banco cuida, mas checamos UI
    const jaExiste = supervisoes.some(s => 
      s.periodo_id === periodo.id && 
      s.turma_id === form.turma_id
    )
    if (jaExiste) {
      showToast("Esta turma já está atribuída neste horário de recreio", "error")
      return
    }

    const { error } = await supabase.from("recreio_supervisao").insert({
      escola_id: escolaId,
      periodo_id: periodo.id,
      dia_semana: diaSelecionado,
      turma_id: form.turma_id,
      professor_id: form.professor_id || null,
      monitor_id: form.monitor_id || null,
    })

    if (error) {
      showToast("Erro ao atribuir: " + error.message, "error")
      return
    }

    showToast("Turma atribuída ao recreio com equipe de supervisão", "success")
    setAtribForm(periodo.id, { turma_id: "", professor_id: "", monitor_id: "" })
    carregarTudo()
  }

  async function atualizarEquipe(supervisaoId: string, campo: "professor_id" | "monitor_id", valor: string | null) {
    const { error } = await supabase
      .from("recreio_supervisao")
      .update({ [campo]: valor })
      .eq("id", supervisaoId)
    if (error) {
      showToast("Erro ao atualizar equipe: " + error.message, "error")
      return
    }
    showToast("Equipe de supervisão atualizada", "success")
    carregarTudo()
  }

  async function removerSupervisao(id: string, turmaNome: string) {
    if (!confirm(`Remover ${turmaNome} deste horário de recreio? Todas as atividades cadastradas também serão removidas.`)) return
    await supabase.from("recreio_supervisao").delete().eq("id", id)
    showToast("Turma removida do recreio", "success")
    carregarTudo()
  }

  // ========== ATIVIDADES DURANTE O RECREIO ==========
  async function adicionarAtividade(supervisaoId: string, descricao: string, duracao?: number) {
    if (!descricao.trim()) return
    const ordem = (supervisoes.find(s => s.id === supervisaoId)?.atividades.length || 0) + 1
    const { error } = await supabase.from("recreio_atividades").insert({
      recreio_supervisao_id: supervisaoId,
      descricao: descricao.trim(),
      duracao_minutos: duracao || null,
      ordem
    })
    if (error) {
      showToast("Erro ao adicionar atividade: " + error.message, "error")
      return
    }
    showToast("Atividade adicionada ao recreio", "success")
    carregarTudo()
  }

  async function removerAtividade(id: string) {
    await supabase.from("recreio_atividades").delete().eq("id", id)
    showToast("Atividade removida", "success")
    carregarTudo()
  }

  // Limpar tudo do dia (útil para recomeçar a escala)
  async function limparDia() {
    if (!escolaId) return
    if (!confirm(`Limpar TODAS as atribuições de recreio de ${DIAS_SEMANA[diaSelecionado]}?`)) return
    await supabase
      .from("recreio_supervisao")
      .delete()
      .eq("escola_id", escolaId)
      .eq("dia_semana", diaSelecionado)
    showToast("Dia limpo", "success")
    carregarTudo()
  }

  // Agrupar supervisões por período (slot)
  const supervisoesPorPeriodo = periodosRecreio.map(periodo => {
    const doSlot = supervisoes
      .filter(s => s.periodo_id === periodo.id)
      .sort((a, b) => (a.turma?.nome || "").localeCompare(b.turma?.nome || ""))
    return { periodo, supervisoes: doSlot }
  })

  // Recreio "agora" enriquecido (mostra todas as turmas + quem administra)
  function calcularRecreioAtual() {
    const agora = new Date()
    const horaAtual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
    const dia = (agora.getDay() + 6) % 7 // 0=dom ... 6=sáb (compatível)

    // Só se for o dia selecionado ou hoje
    if (dia !== diaSelecionado) return null

    return supervisoes.filter(s => {
      const ini = s.periodo?.hora_inicio || ""
      const fim = s.periodo?.hora_fim || ""
      return ini <= horaAtual && fim >= horaAtual
    })
  }
  const recreioAgora = calcularRecreioAtual()

  function abrirARIAComDica() {
    const prompt = "Me ajude a montar uma escala segura de recreio para creche. Quero separar os horários (usando os períodos do tipo 'recreio' que já tenho) para que no máximo 2 turmas saiam por vez. Quero ver claramente o professor e o monitor responsável por cada turma em cada slot, e também planejar atividades durante o recreio (brincadeiras, roda, lanche etc). Me dê uma sugestão prática de atribuições."
    window.dispatchEvent(new CustomEvent("aria:abrir-chat", { detail: { prompt } }))
  }

  if (loading) return <Loading />

  const temSlots = periodosRecreio.length > 0
  const temTurmas = turmas.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <TreePine className="h-7 w-7 text-emerald-400" />
            Recreio Escalonado — Creche
          </h1>
          <p className="text-sm text-emerald-300/80 mt-1">
            Separe os horários para evitar aglomeração. Cada turma tem seu Professor + Monitor administrando o recreio. Cadastre atividades durante cada bloco.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMonitores(!showMonitores)}>
            <Users className="h-4 w-4 mr-2" />
            {showMonitores ? "Fechar" : "Gerenciar"} Monitores
          </Button>
          <Button variant="outline" onClick={abrirARIAComDica}>
            <Brain className="h-4 w-4 mr-2" />
            Pedir sugestão de escala à ARIA
          </Button>
          <Button variant="outline" onClick={limparDia} disabled={supervisoes.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" /> Limpar dia
          </Button>
        </div>
      </div>

      {/* Explicação do modelo (importante para diretor/secretaria entender) */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 text-emerald-100/90">
              <p className="font-medium">Como funciona o recreio seguro na creche:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                <li>Crie vários <strong>períodos do tipo "recreio"</strong> em <a href="/horarios" className="underline">/horarios</a> (ex: Lanche 08:20-08:40, Recreio 09:30-10:00, Almoço 11:00-11:40). Isso cria os slots escalonados.</li>
                <li>Atribua <strong>turmas diferentes a slots diferentes</strong> → nunca todas juntas no pátio.</li>
                <li>Para cada turma em cada slot: o sistema <strong>pré-preenche automaticamente</strong> com o Professor e Monitor padrão cadastrado na sala (defina isso na página Salas). Você pode ajustar manualmente se precisar (ex: substituição naquele dia).</li>
                <li>Cadastre <strong>atividades</strong> que vão acontecer durante aquele recreio (brincadeiras, roda cantada, lanche supervisionado, etc).</li>
                <li>A cada "troca" de horário você vê claramente quem está cuidando de cada grupo.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gerenciador de Monitores (colapsável) */}
      {showMonitores && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" /> Monitores / Auxiliares de Recreio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Input 
                placeholder="Nome do monitor" 
                value={novoMonitorNome} 
                onChange={e => setNovoMonitorNome(e.target.value)} 
                className="w-64" 
              />
              <Input 
                placeholder="Telefone (opcional)" 
                value={novoMonitorTel} 
                onChange={e => setNovoMonitorTel(e.target.value)} 
                className="w-48" 
              />
              <Button onClick={adicionarMonitor} disabled={!novoMonitorNome.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Monitor
              </Button>
            </div>

            {monitores.length === 0 ? (
              <p className="text-sm text-muted">Nenhum monitor cadastrado ainda. Monitores ajudam na supervisão junto com os professores.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {monitores.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{m.nome}</div>
                      {m.telefone && <div className="text-xs opacity-60">{m.telefone}</div>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerMonitor(m.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seletor de dia */}
      <div className="flex flex-wrap gap-2">
        {DIAS_SEMANA.slice(0, 5).map((nome, idx) => (
          <Button
            key={idx}
            variant={diaSelecionado === idx ? "default" : "outline"}
            size="sm"
            onClick={() => setDiaSelecionado(idx)}
          >
            {nome}
          </Button>
        ))}
        <div className="flex-1" />
        <div className="text-xs self-center opacity-70 pr-2">
          {supervisoes.length} atribuição(ões) neste dia
        </div>
      </div>

      {/* Alerta se não tem slots de recreio */}
      {!temSlots && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3 text-amber-300">
              <Clock className="h-5 w-5 mt-0.5" />
              <div className="space-y-2">
                <div>
                  <p className="font-medium">Nenhum período de recreio cadastrado</p>
                  <p className="text-xs">Vá em <a href="/horarios" className="underline font-medium">Horários / Períodos</a> e crie períodos com tipo <strong>recreio</strong> (ex: Lanche 08:20-08:40, Recreio 09:30-10:00, Almoço 11:00-11:40). Cada um vira um slot escalonado diferente.</p>
                </div>
                <Button size="sm" onClick={() => window.location.href = "/horarios"}>
                  <Clock className="h-4 w-4 mr-2" /> Ir criar os slots de recreio agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!temTurmas && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-4 text-sm">Cadastre turmas (salas) primeiro para poder atribuir recreios.</CardContent>
        </Card>
      )}

      {/* ==================== SLOTS DE RECREIO DO DIA ==================== */}
      <div className="space-y-4">
        {supervisoesPorPeriodo.length === 0 && temSlots && (
          <EmptyState 
            icon={<Clock className="h-10 w-10" />} 
            title="Nenhum slot de recreio no dia" 
            description="Selecione outro dia ou cadastre mais períodos do tipo recreio em /horarios" 
          />
        )}

        {supervisoesPorPeriodo.map(({ periodo, supervisoes: supsDoSlot }) => {
          const form = getAtribForm(periodo.id)
          const jaUsadasNoSlot = new Set(supsDoSlot.map(s => s.turma_id))

          return (
            <Card key={periodo.id} className="overflow-hidden">
              <CardHeader className="bg-emerald-500/10 py-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="warning" className="text-xs">{periodo.nome}</Badge>
                    <span className="font-mono text-emerald-200">{periodo.hora_inicio} — {periodo.hora_fim}</span>
                  </div>
                  <div className="text-xs font-normal opacity-70">
                    {supsDoSlot.length} turma(s) neste slot
                  </div>
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Formulário de atribuição rápida */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end border-b border-white/10 pb-4">
                  <div>
                    <Label className="text-xs">Turma / Sala</Label>
                    <Select 
                      value={form.turma_id} 
                      onChange={e => {
                        const tid = e.target.value
                        const t = turmas.find(x => x.id === tid)
                        setAtribForm(periodo.id, {
                          turma_id: tid,
                          professor_id: t?.professor_responsavel_id || "",
                          monitor_id: t?.monitor_responsavel_id || ""
                        })
                      }}
                    >
                      <option value="">— escolher turma —</option>
                      {turmas
                        .filter(t => !jaUsadasNoSlot.has(t.id))
                        .map(t => (
                          <option key={t.id} value={t.id}>{t.nome}</option>
                        ))}
                    </Select>
                    <p className="text-[10px] text-emerald-300/60 mt-0.5">O professor e monitor padrão da sala são preenchidos automaticamente.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Professor responsável</Label>
                    <Select 
                      value={form.professor_id} 
                      onChange={e => setAtribForm(periodo.id, { professor_id: e.target.value })}
                    >
                      <option value="">— definir depois —</option>
                      {professores.map(p => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Monitor / Auxiliar</Label>
                    <Select 
                      value={form.monitor_id} 
                      onChange={e => setAtribForm(periodo.id, { monitor_id: e.target.value })}
                    >
                      <option value="">— definir depois —</option>
                      {monitores.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Button 
                      onClick={() => atribuirTurmaAoSlot(periodo)} 
                      disabled={!form.turma_id}
                      className="w-full"
                    >
                      <UserCheck className="h-4 w-4 mr-2" /> Atribuir ao recreio
                    </Button>
                  </div>
                </div>

                {/* TURMAS NESTE SLOT + EQUIPE + ATIVIDADES */}
                {supsDoSlot.length === 0 ? (
                  <div className="text-xs opacity-60 py-2 pl-1">Nenhuma turma atribuída ainda neste horário.</div>
                ) : (
                  <div className="space-y-3">
                    {supsDoSlot.map((sup) => (
                      <div 
                        key={sup.id} 
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Turma + equipe */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold flex items-center gap-2 text-lg">
                              {sup.turma?.nome}
                              <Badge variant="success" className="text-[10px]">no recreio</Badge>
                            </div>

                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                              {/* Professor */}
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-300/70 w-20 text-xs">Professor:</span>
                                <Select 
                                  value={sup.professor_id || ""} 
                                  onChange={(e) => atualizarEquipe(sup.id, "professor_id", e.target.value || null)}
                                  className="flex-1"
                                >
                                  <option value="">— não definido —</option>
                                  {professores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                  ))}
                                </Select>
                              </div>

                              {/* Monitor */}
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-300/70 w-20 text-xs">Monitor:</span>
                                <Select 
                                  value={sup.monitor_id || ""} 
                                  onChange={(e) => atualizarEquipe(sup.id, "monitor_id", e.target.value || null)}
                                  className="flex-1"
                                >
                                  <option value="">— não definido —</option>
                                  {monitores.map(m => (
                                    <option key={m.id} value={m.id}>{m.nome}</option>
                                  ))}
                                </Select>
                              </div>
                            </div>

                            {/* Atividades durante o recreio desta turma */}
                            <div className="mt-3">
                              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300/80 mb-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Atividades / Rotinas deste recreio
                              </div>

                              {sup.atividades.length > 0 ? (
                                <div className="space-y-1 mb-2">
                                  {sup.atividades.map(ativ => (
                                    <div key={ativ.id} className="flex items-center justify-between bg-black/20 rounded px-2 py-1 text-xs group">
                                      <span>
                                        {ativ.descricao}
                                        {ativ.duracao_minutos ? <span className="opacity-60"> ({ativ.duracao_minutos} min)</span> : null}
                                      </span>
                                      <button 
                                        onClick={() => removerAtividade(ativ.id)}
                                        className="opacity-40 group-hover:opacity-100 hover:text-red-400"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[11px] opacity-50 mb-1.5">Nenhuma atividade registrada ainda.</div>
                              )}

                              {/* Adicionar atividade inline */}
                              <AddAtividadeForm 
                                onAdd={(desc, dur) => adicionarAtividade(sup.id, desc, dur)} 
                              />
                            </div>
                          </div>

                          {/* Ações */}
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => removerSupervisao(sup.id, sup.turma?.nome || "turma")}
                            className="text-red-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* RECREIO AGORA — visão operacional rica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-emerald-400" /> 
            Quem está no recreio agora (visão do dia selecionado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recreioAgora && recreioAgora.length > 0 ? (
            <div className="space-y-3">
              {recreioAgora.map(sup => (
                <div key={sup.id} className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3">
                  <div className="font-semibold">{sup.turma?.nome} • {sup.periodo?.nome} ({sup.periodo?.hora_inicio}–{sup.periodo?.hora_fim})</div>
                  <div className="text-sm mt-1 grid grid-cols-2 gap-2">
                    <div>Professor: <span className="font-medium">{sup.professor?.nome || "— não definido —"}</span></div>
                    <div>Monitor: <span className="font-medium">{sup.monitor?.nome || "— não definido —"}</span></div>
                  </div>
                  {sup.atividades.length > 0 && (
                    <div className="text-xs mt-1.5 opacity-80">
                      Atividades: {sup.atividades.map(a => a.descricao).join(" • ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm opacity-70">Nenhuma turma em recreio neste momento (de acordo com os horários do dia selecionado).</p>
          )}
          <p className="text-[10px] mt-3 opacity-50">Mude o dia acima para ver a escala de outros dias. Os horários reais usam o relógio do navegador.</p>
        </CardContent>
      </Card>

      {/* Rodapé de ajuda */}
      <div className="text-xs text-center opacity-60 pt-2">
        Dica: use a ARIA (cérebro) para pedir sugestões de escala boa. Tudo aqui é manual e controlado por você — mais rápido e confiável.
      </div>
    </div>
  )
}

/** Pequeno componente inline para adicionar atividade rápido */
function AddAtividadeForm({ onAdd }: { onAdd: (descricao: string, duracao?: number) => void }) {
  const [desc, setDesc] = useState("")
  const [dur, setDur] = useState<number | "">("")

  function submit() {
    if (!desc.trim()) return
    onAdd(desc, typeof dur === "number" ? dur : undefined)
    setDesc("")
    setDur("")
  }

  return (
    <div className="flex gap-2">
      <Input 
        value={desc} 
        onChange={e => setDesc(e.target.value)} 
        onKeyDown={e => { if (e.key === "Enter") submit() }}
        placeholder="Ex: Roda cantada, Brincadeira livre, Lanche supervisionado..." 
        className="text-xs h-8" 
      />
      <Input 
        type="number" 
        value={dur} 
        onChange={e => setDur(e.target.value ? Number(e.target.value) : "")} 
        placeholder="min" 
        className="w-16 text-xs h-8" 
      />
      <Button size="sm" variant="secondary" onClick={submit} disabled={!desc.trim()}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
