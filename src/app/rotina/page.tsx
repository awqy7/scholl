"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { 
  Plus, Trash2, Clock, Users, TreePine, Baby, 
  Copy, Sparkles, Eye 
} from "lucide-react"
import { useToast } from "@/components/shared/toast"
import { useEscola } from "@/lib/escola-context"
import { escolaTemRecreioIntercalado } from "@/lib/escola-tipo"
import { DIAS_SEMANA } from "@/lib/utils"
import Link from "next/link"
import type { Periodo, Turma, Professor, Monitor, RecreioSupervisao, RecreioAtividade } from "@/types/database"

export default function RotinaPage() {
  return (
    <AppShell>
      <RotinaContent />
    </AppShell>
  )
}

type SupervisaoComAtividades = RecreioSupervisao & { atividades: RecreioAtividade[] }

function RotinaContent() {
  const supabase = createClient()
  const { showToast } = useToast()
  const { tipo } = useEscola()
  const isCreche = escolaTemRecreioIntercalado(tipo)

  const [loading, setLoading] = useState(true)
  const [escolaId, setEscolaId] = useState<string | null>(null)

  const [recreioPeriodos, setRecreioPeriodos] = useState<Periodo[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [monitores, setMonitores] = useState<Monitor[]>([])
  const [supervisoes, setSupervisoes] = useState<SupervisaoComAtividades[]>([])

  const [diaSelecionado, setDiaSelecionado] = useState(1)
  const [showVisualizacao, setShowVisualizacao] = useState(false)

  // Interligação com ausências: quem está ausente hoje (padrões)
  const [faltasHoje, setFaltasHoje] = useState<any[]>([])
  const [absentProfIds, setAbsentProfIds] = useState<Set<string>>(new Set())
  const [absentMonIds, setAbsentMonIds] = useState<Set<string>>(new Set())

  const carregarTudo = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)
    setEscolaId(eId)

    const hoje = new Date().toISOString().split("T")[0]
    const [
      pRes, tRes, profRes, monRes, supRes, faltasRes
    ] = await Promise.all([
      supabase.from("periodos").select("*").eq("escola_id", eId).eq("tipo", "recreio").order("ordem"),
      supabase.from("turmas")
        .select("*, serie:series(*), professor_responsavel:professores!professor_responsavel_id(*), monitor_responsavel:monitores!monitor_responsavel_id(*)")
        .eq("escola_id", eId).order("nome"),
      supabase.from("professores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("monitores").select("*").eq("escola_id", eId).order("nome"),
      supabase.from("recreio_supervisao")
        .select(`*, turma:turmas(*), periodo:periodos(*), professor:professores(*), monitor:monitores(*)`)
        .eq("escola_id", eId)
        .eq("dia_semana", diaSelecionado),
      supabase.from("faltas").select("professor_id").eq("escola_id", eId).eq("data", hoje)
    ])

    if (pRes.data) setRecreioPeriodos(pRes.data as any)
    if (tRes.data) setTurmas(tRes.data as any)
    if (profRes.data) setProfessores(profRes.data as any)
    if (monRes.data) setMonitores(monRes.data as any)

    // Interligação: ausentes de hoje (padrões das salas)
    const profAbsent = new Set<string>()
    ;(faltasRes.data || []).forEach((f: any) => f.professor_id && profAbsent.add(f.professor_id))
    setFaltasHoje(faltasRes.data || [])
    setAbsentProfIds(profAbsent)
    // Monitores: usamos status por enquanto (sem tabela dedicada de falta de monitor)
    const monAbsent = new Set<string>(monRes.data?.filter((m: any) => m.status && m.status !== "presente").map((m: any) => m.id) || [])
    setAbsentMonIds(monAbsent)

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

  // Permite que Ausências dispare reload aqui quando aplica cobertura diretamente no recreio
  useEffect(() => {
    const handler = () => carregarTudo()
    window.addEventListener("rotina:reload", handler)
    return () => window.removeEventListener("rotina:reload", handler)
  }, [carregarTudo])

  // GERAÇÃO AUTOMÁTICA - reconhece as salas que já têm padrão e gera o planejamento escalonado balanceado
  async function gerarPlanejamentoEscalonado() {
    if (!escolaId) return
    if (!confirm("Gerar o planejamento escalonado automático?\n\nO sistema vai usar só as salas que já têm Professor e/ou Monitor padrão cadastrado e distribuir de forma segura pelos horários de recreio (máx ~3 por horário). Isso substitui o planejamento atual deste dia.")) return

    // Apenas salas com padrão + respeitando ausências de hoje (interligação)
    let turmasComPadrao = turmas.filter(t => t.professor_responsavel_id || t.monitor_responsavel_id)

    if (turmasComPadrao.length === 0) {
      showToast("Nenhuma sala com padrão de Professor/Monitor cadastrado. Cadastre primeiro na página Salas.", "error")
      return
    }
    if (recreioPeriodos.length === 0) {
      showToast("Crie primeiro horários com tipo 'recreio' (com horários diferentes) em /horarios.", "error")
      return
    }

    // Limpa o dia
    await supabase.from("recreio_supervisao").delete().eq("escola_id", escolaId).eq("dia_semana", diaSelecionado)

    const slots = [...recreioPeriodos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    const maxPorSlot = 3
    const inserts: any[] = []
    let slotIdx = 0

    // Pessoas disponíveis hoje (exclui ausentes)
    const profsDisponiveis = professores.filter(p => !absentProfIds.has(p.id) && (!p.status || p.status === "presente"))
    const monsDisponiveis = monitores.filter(m => !absentMonIds.has(m.id))

    for (const turma of turmasComPadrao) {
      // Se o padrão professor está ausente hoje, tenta achar um substituto que seja padrão de outras salas (ou qualquer disponível)
      let profToUse = turma.professor_responsavel_id
      if (profToUse && absentProfIds.has(profToUse)) {
        // Prioriza quem é padrão de alguma turma (similar à lógica de faltas)
        const otherPadroes = new Set(turmas.filter(t => t.professor_responsavel_id && !absentProfIds.has(t.professor_responsavel_id)).map(t => t.professor_responsavel_id))
        const candidate = profsDisponiveis.find(p => otherPadroes.has(p.id)) || profsDisponiveis[0]
        if (candidate) profToUse = candidate.id
      }

      let monToUse = turma.monitor_responsavel_id
      if (monToUse && absentMonIds.has(monToUse)) {
        const otherPadroesMon = new Set(turmas.filter(t => t.monitor_responsavel_id && !absentMonIds.has(t.monitor_responsavel_id)).map(t => t.monitor_responsavel_id))
        const candidateM = monsDisponiveis.find(m => otherPadroesMon.has(m.id)) || monsDisponiveis[0]
        if (candidateM) monToUse = candidateM.id
      }

      let placed = false
      for (let attempt = 0; attempt < slots.length; attempt++) {
        const slot = slots[slotIdx % slots.length]
        const count = inserts.filter(i => i.periodo_id === slot.id).length
        if (count < maxPorSlot) {
          inserts.push({
            escola_id: escolaId,
            periodo_id: slot.id,
            dia_semana: diaSelecionado,
            turma_id: turma.id,
            professor_id: profToUse,
            monitor_id: monToUse,
          })
          slotIdx++
          placed = true
          break
        }
        slotIdx++
      }
      if (!placed && slots[0]) {
        inserts.push({
          escola_id: escolaId,
          periodo_id: slots[0].id,
          dia_semana: diaSelecionado,
          turma_id: turma.id,
          professor_id: profToUse,
          monitor_id: monToUse,
        })
      }
    }

    if (inserts.length > 0) {
      await supabase.from("recreio_supervisao").insert(inserts)

      // adiciona algumas atividades padrão de recreio
      const { data: novas } = await supabase.from("recreio_supervisao").select("id").eq("escola_id", escolaId).eq("dia_semana", diaSelecionado)
      if (novas?.length) {
        const padrao = [
          { descricao: "Brincadeira livre supervisionada", duracao_minutos: 10, ordem: 1 },
          { descricao: "Hidratação e checagem de segurança", duracao_minutos: 5, ordem: 2 },
          { descricao: "Retorno organizado à sala", duracao_minutos: 5, ordem: 3 },
        ]
        const atividadesInserts = []
        for (const s of novas) {
          for (const at of padrao) {
            atividadesInserts.push({ recreio_supervisao_id: s.id, ...at })
          }
        }
        if (atividadesInserts.length > 0) {
          await supabase.from("recreio_atividades").insert(atividadesInserts)
        }
      }
    }

    showToast(`Planejamento escalonado gerado automaticamente para ${turmasComPadrao.length} salas!`, "success")
    carregarTudo()
  }

  async function copiarDoDiaAnterior() {
    if (!escolaId) return
    const diaAnterior = (diaSelecionado + 6) % 7

    const { data: anteriores } = await supabase
      .from("recreio_supervisao")
      .select("*")
      .eq("escola_id", escolaId)
      .eq("dia_semana", diaAnterior)

    if (!anteriores || anteriores.length === 0) {
      showToast("Não há planejamento de recreio no dia anterior.", "error")
      return
    }

    const novos = anteriores.map((s: any) => ({
      ...s,
      dia_semana: diaSelecionado,
      id: undefined,
      created_at: undefined
    }))

    await supabase.from("recreio_supervisao").insert(novos)
    showToast("Planejamento do dia anterior copiado!", "success")
    carregarTudo()
  }

  async function limparDia() {
    if (!escolaId || !confirm(`Limpar todo o planejamento de recreio de ${DIAS_SEMANA[diaSelecionado]}?`)) return
    await supabase.from("recreio_supervisao").delete().eq("escola_id", escolaId).eq("dia_semana", diaSelecionado)
    showToast("Dia limpo", "success")
    carregarTudo()
  }

  // Manipulação simples e direta (após o gerar automático)
  async function atualizarEquipe(supervisaoId: string, campo: "professor_id" | "monitor_id", valor: string | null) {
    const { error } = await supabase.from("recreio_supervisao").update({ [campo]: valor }).eq("id", supervisaoId)
    if (error) {
      showToast("Erro: " + error.message, "error")
      return
    }
    showToast("Equipe atualizada", "success")
    carregarTudo()
  }

  async function removerDoPlanejamento(id: string, nome: string) {
    if (!confirm(`Remover ${nome} do planejamento de hoje?`)) return
    await supabase.from("recreio_supervisao").delete().eq("id", id)
    showToast("Removido do planejamento", "success")
    carregarTudo()
  }

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
      showToast("Erro: " + error.message, "error")
      return
    }
    showToast("Atividade adicionada", "success")
    carregarTudo()
  }

  async function removerAtividade(id: string) {
    await supabase.from("recreio_atividades").delete().eq("id", id)
    showToast("Atividade removida", "success")
    carregarTudo()
  }

  // Apenas os slots de recreio (tipo = recreio)
  const slots = [...recreioPeriodos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  const porSlot = slots.map(periodo => ({
    periodo,
    supervisoes: supervisoes.filter(s => s.periodo_id === periodo.id)
  }))

  // Salas com padrão que ainda não estão no planejamento de hoje (opção secundária)
  const pendentes = turmas.filter(t => 
    (t.professor_responsavel_id || t.monitor_responsavel_id) &&
    !supervisoes.some(s => s.turma_id === t.id)
  )

  if (loading) return <Loading />

  if (!isCreche) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center space-y-4">
        <Baby className="h-12 w-12 mx-auto text-emerald-400/50" />
        <h2 className="text-xl font-bold">Recreio Escalonado</h2>
        <p>Esta ferramenta é exclusiva para Creche / Educação Infantil.</p>
        <Link href="/dashboard"><Button>Voltar ao Painel</Button></Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <TreePine className="h-7 w-7 text-emerald-400" />
            Recreio Escalonado — Creche
          </h1>
          <p className="text-sm text-emerald-300/80 mt-1">
            O sistema reconhece automaticamente as salas que já têm Professor e Monitor padrão cadastrado. 
            Gere o planejamento escalonado com um clique. Depois manipule facilmente.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={gerarPlanejamentoEscalonado} size="lg">
            <Sparkles className="h-4 w-4 mr-2" /> Gerar Planejamento Escalonado Automático
          </Button>
          <Button onClick={copiarDoDiaAnterior} variant="outline">
            <Copy className="h-4 w-4 mr-2" /> Copiar do dia anterior
          </Button>
          <Button onClick={limparDia} variant="outline" disabled={supervisoes.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" /> Limpar dia
          </Button>
          <Button onClick={() => setShowVisualizacao(!showVisualizacao)} variant="outline">
            <Eye className="h-4 w-4 mr-2" /> {showVisualizacao ? "Ocultar" : "Ver"} Visualização por Sala
          </Button>
        </div>
      </div>

      {/* Seletor de dia */}
      <div className="flex gap-1">
        {DIAS_SEMANA.slice(0, 5).map((nome, idx) => (
          <Button
            key={idx}
            size="sm"
            variant={diaSelecionado === idx ? "default" : "outline"}
            onClick={() => setDiaSelecionado(idx)}
          >
            {nome}
          </Button>
        ))}
      </div>

      {/* Aviso importante + status de interligação com Ausências */}
      <div className="text-xs p-3 rounded border border-emerald-500/30 bg-emerald-500/5">
        <strong>Como funciona:</strong> Só usa as salas que já têm Professor/Monitor padrão na página <Link href="/turmas" className="underline">Salas</Link>. 
        O botão "Gerar" cria o plano balanceado automaticamente (máx ~3 turmas por horário para segurança). 
        Depois é só editar equipe ou atividades diretamente.
      </div>
      {(absentProfIds.size > 0 || absentMonIds.size > 0) && (
        <div className="text-xs p-2 rounded border border-amber-500/40 bg-amber-500/5">
          Hoje há {absentProfIds.size} professor(es) e {absentMonIds.size} monitor(es) com ausência registrada. 
          O gerador e os slots já evitam usar os padrões ausentes quando possível e mostram atalhos de cobertura rápida.
          Registre ou aplique coberturas em <Link href="/ausencias" className="underline">Ausências</Link>.
        </div>
      )}

      {/* VISUALIZAÇÃO POR SALA */}
      {showVisualizacao && (
        <Card>
          <CardHeader>
            <CardTitle>Visualização — Recreio de cada sala (hoje)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {turmas.map(turma => {
              const meus = supervisoes.filter(s => s.turma_id === turma.id)
              return (
                <div key={turma.id} className="border border-white/10 rounded p-2">
                  <div className="font-medium">{turma.nome}</div>
                  {meus.length ? meus.map((s,i) => <div key={i} className="text-xs opacity-80">{s.periodo?.hora_inicio}–{s.periodo?.hora_fim} • {s.periodo?.nome} • {s.professor?.nome || "—"} + {s.monitor?.nome || "—"}</div>) : <div className="text-xs opacity-60">sem recreio hoje</div>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* SLOTS DE RECREIO + MANIPULAÇÃO FÁCIL */}
      <div className="space-y-4">
        {recreioPeriodos.length === 0 && (
          <EmptyState 
            icon={<Clock className="h-10 w-10" />} 
            title="Nenhum horário de recreio cadastrado" 
            description="Crie períodos com tipo 'recreio' (horários diferentes) em /horarios para poder escalonar." 
          />
        )}

        {porSlot.map(({ periodo, supervisoes: doSlot }) => (
          <Card key={periodo.id}>
            <CardHeader className="py-3 bg-emerald-500/10">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-semibold">{periodo.nome}</span>
                  <span className="ml-2 font-mono text-sm opacity-70">{periodo.hora_inicio} — {periodo.hora_fim}</span>
                </div>
                <Badge>{doSlot.length} turma(s)</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              {doSlot.length === 0 && (
                <div className="text-xs opacity-60">Nenhuma turma neste horário ainda.</div>
              )}

              {doSlot.map(sup => (
                <div key={sup.id} className="border border-white/10 rounded-xl p-3 bg-white/5 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg flex items-center gap-2">
                        {sup.turma?.nome}
                        {(sup.professor_id && sup.turma?.professor_responsavel_id && sup.professor_id !== sup.turma.professor_responsavel_id) && (
                          <Badge variant="warning" className="text-[9px]">cobertura prof</Badge>
                        )}
                        {(sup.monitor_id && sup.turma?.monitor_responsavel_id && sup.monitor_id !== sup.turma.monitor_responsavel_id) && (
                          <Badge variant="warning" className="text-[9px]">cobertura monitor</Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          Professor:
                          <Select value={sup.professor_id || ""} onChange={e => atualizarEquipe(sup.id, "professor_id", e.target.value || null)}>
                            <option value="">(não definido)</option>
                            {professores.map(p => <option key={p.id} value={p.id}>{p.nome}{absentProfIds.has(p.id) ? " (ausente)" : ""}</option>)}
                          </Select>
                        </div>
                        <div>
                          Monitor:
                          <Select value={sup.monitor_id || ""} onChange={e => atualizarEquipe(sup.id, "monitor_id", e.target.value || null)}>
                            <option value="">(não definido)</option>
                            {monitores.map(m => <option key={m.id} value={m.id}>{m.nome}{absentMonIds.has(m.id) ? " (ausente)" : ""}</option>)}
                          </Select>
                        </div>
                      </div>

                      {/* Aviso + ação rápida de cobertura quando o atual é ausente (interligação forte Ausências ↔ Rotina) */}
                      {((sup.professor_id && absentProfIds.has(sup.professor_id)) || (sup.monitor_id && absentMonIds.has(sup.monitor_id))) && (
                        <div className="mt-2 text-xs bg-red-500/10 border border-red-500/40 rounded p-2">
                          ⚠️ Padrão ausente neste slot. 
                          <button 
                            className="ml-2 underline text-red-300"
                            onClick={async () => {
                              // Sugere e aplica um substituto rápido do mesmo tipo
                              const isProfAbsent = sup.professor_id && absentProfIds.has(sup.professor_id)
                              const field = isProfAbsent ? "professor_id" : "monitor_id"
                              const absentPerson = isProfAbsent ? sup.professor_id : sup.monitor_id
                              const pool = isProfAbsent ? professores.filter(p => !absentProfIds.has(p.id)) : monitores.filter(m => !absentMonIds.has(m.id))
                              if (pool.length === 0) { alert("Nenhum substituto disponível"); return }
                              // Prioriza quem já é padrão de outras turmas
                              const otherPadroes = new Set(
                                turmas.filter(t => (isProfAbsent ? t.professor_responsavel_id : t.monitor_responsavel_id) && !(isProfAbsent ? absentProfIds.has(t.professor_responsavel_id!) : absentMonIds.has(t.monitor_responsavel_id!)))
                                  .map(t => isProfAbsent ? t.professor_responsavel_id : t.monitor_responsavel_id)
                              )
                              const best = pool.find((x: any) => otherPadroes.has(x.id)) || pool[0]
                              await atualizarEquipe(sup.id, field as any, best.id)
                              showToast(`Cobertura aplicada: ${best.nome}`, "success")
                            }}
                          >
                            Aplicar cobertura rápida agora
                          </button>
                        </div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removerDoPlanejamento(sup.id, sup.turma?.nome || "")}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>

                  {/* Atividades / Rotinas durante o recreio */}
                  <div className="mt-3">
                    <div className="text-xs font-medium mb-1">Atividades / Rotinas durante este recreio:</div>
                    {sup.atividades.length > 0 ? (
                      sup.atividades.map(a => (
                        <div key={a.id} className="flex justify-between text-xs bg-black/20 px-2 py-0.5 rounded mb-0.5 group">
                          <span>{a.descricao}{a.duracao_minutos ? ` (${a.duracao_minutos} min)` : ''}</span>
                          <button onClick={() => removerAtividade(a.id)} className="opacity-40 group-hover:opacity-100 text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs opacity-50">Sem atividades detalhadas ainda.</div>
                    )}

                    <div className="flex gap-2 mt-1">
                      <Input 
                        placeholder="Adicionar atividade (ex: Brincadeira livre supervisionada)" 
                        className="text-xs h-8" 
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.currentTarget.value.trim()) {
                            adicionarAtividade(sup.id, e.currentTarget.value.trim())
                            e.currentTarget.value = ""
                          }
                        }}
                      />
                      <Button size="sm" variant="secondary" onClick={() => {
                        const v = prompt("Descreva a atividade/rotina durante o recreio:")
                        if (v && v.trim()) adicionarAtividade(sup.id, v.trim())
                      }}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Adição manual rápida (secundária) */}
              {pendentes.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <Label className="text-xs">Adicionar manualmente (opcional):</Label>
                  <Select onChange={async (e) => {
                    const tid = e.target.value
                    if (!tid) return
                    const t = turmas.find(x => x.id === tid)
                    if (!t) return
                    await supabase.from("recreio_supervisao").insert({
                      escola_id: escolaId,
                      periodo_id: periodo.id,
                      dia_semana: diaSelecionado,
                      turma_id: tid,
                      professor_id: t.professor_responsavel_id,
                      monitor_id: t.monitor_responsavel_id,
                    })
                    showToast("Adicionado com o padrão da sala", "success")
                    carregarTudo()
                  }}>
                    <option value="">— escolher sala com padrão —</option>
                    {pendentes.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-xs opacity-50">
        Dica: O botão "Gerar Planejamento Escalonado Automático" é o principal. Ele reconhece as salas que já têm padrão e cria o plano balanceado automaticamente. Depois é só editar equipe ou atividades nos cards.
      </div>
    </div>
  )
}

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
        placeholder="Ex: Brincadeira livre, Roda cantada..." 
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
