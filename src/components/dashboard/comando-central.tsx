"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { consumirPedidoAbrirChat, esconderFabAria, mostrarFabAria } from "@/components/dashboard/aria-floating-button"
import { useChat } from "@/lib/chat-context"
import { createClient } from "@/lib/supabase/client"
import { formatIaError } from "@/lib/ia-utils"
import { SUGESTOES_RAPIDAS, normalizarAcaoComando, normalizarParamsComando } from "@/lib/ia-comando"
import { useEscola } from "@/lib/escola-context"
import { Send, X, Loader2, Paperclip, Trash2, Brain, Lightbulb, Copy, Check } from "lucide-react"
import type { Mensagem } from "@/lib/chat-context"

function getGuidanceForAction(acao: string, params: any): string {
  const a = (acao || "").toLowerCase()
  if (a.includes("criar") || a.includes("cadastrar") || a.includes("adicionar")) {
    if (a.includes("professor")) return "✅ Para cadastrar professores use o botão + Novo Professor na página Professores."
    if (a.includes("turma") || a.includes("sala")) return "✅ Vá na página Turmas e clique em + Nova Turma."
    return "✅ Cadastros agora são feitos manualmente nas páginas específicas."
  }
  if (a.includes("deletar") || a.includes("apagar") || a.includes("remover") || a.includes("excluir")) {
    return "⚠️ Ações de exclusão só no modo manual nas páginas."
  }
  if (a.includes("falta") || a.includes("ausente")) {
    return "✅ Registrar falta manualmente na página Faltas."
  }
  if (a.includes("grade") || a.includes("horario")) {
    return "✅ Monte / ajuste a grade na página Grade."
  }
  if (a.includes("substitu")) {
    return "✅ Registre a falta primeiro na página Faltas, depois peça sugestão aqui ou na página Substituições."
  }
  return `✅ ARIA agora é só conselheira. Ação "${acao}" não é mais executada automaticamente. Use as páginas do menu.`
}

export function ComandoCentral() {
  const supabase = createClient()
  const { mensagens, addMensagem, limpar } = useChat()
  const { config } = useEscola()

  const [aberto, setAberto] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const [anexo, setAnexo] = useState<File | null>(null)
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  const sugestoesRapidas = SUGESTOES_RAPIDAS

  useEffect(() => {
    setPortalReady(true)
    if (consumirPedidoAbrirChat()) setAberto(true)

    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<{ prompt?: string }>).detail
      if (detail?.prompt) {
        setInput(detail.prompt)
      }
      setAberto(true)
    }
    window.addEventListener("aria:abrir-chat", onOpen as EventListener)
    return () => window.removeEventListener("aria:abrir-chat", onOpen as EventListener)
  }, [])

  useEffect(() => {
    if (aberto) {
      esconderFabAria()
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      mostrarFabAria()
      setShowSugestoes(false)
    }
  }, [aberto])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberto) setAberto(false)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setAberto((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [aberto])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!aberto) return
      const alvo = e.target as Node
      if (panelRef.current && !panelRef.current.contains(alvo)) {
        // não fecha automaticamente para não atrapalhar o uso
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [aberto])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [mensagens, isTyping])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function executarAcao(acao: string, params: any): Promise<{ ok: boolean; mensagem: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, mensagem: "Usuário não autenticado" }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const escolaId = await getCurrentEscolaId(user.id)

    const allowed = [
      "analisar_escola", "sugerir_melhorias", "relatorio_professor", "prever_faltas",
      "responder_pergunta", "status_sistema", "listar_professores", "listar_turmas",
      "listar_materias", "listar_periodos", "listar_series", "listar_disponiveis",
      "professores_por_especialidade", "resumo_semanal",
    ]

    if (!allowed.includes(acao)) {
      return { ok: true, mensagem: getGuidanceForAction(acao, params) }
    }

    switch (acao) {
      case "analisar_escola": {
        try {
          const [tRes, pRes, mRes, fRes, sRes, gRes] = await Promise.all([
            supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId),
            supabase.from("professores").select("id, nome, status, especialidades, carga_horaria").eq("escola_id", escolaId),
            supabase.from("materias").select("id, nome").eq("escola_id", escolaId),
            supabase.from("faltas").select("*").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(50),
            supabase.from("substituicoes").select("*").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(30),
            supabase.from("grade_horarios").select("*").eq("escola_id", escolaId),
          ])
          const apiRes = await fetch("/api/ia/analisar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turmas: tRes.data || [], professores: pRes.data || [], materias: mRes.data || [], faltas: fRes.data || [], substituicoes: sRes.data || [], grade: gRes.data || [] }),
          })
          const resultado = await apiRes.json()
          if (!apiRes.ok) return { ok: false, mensagem: resultado.error || formatIaError("Erro na análise") }
          const r = resultado as any
          let msg = `**🎯 Análise Completa da Escola**\n\n📊 **Nota Geral:** ${r.nota_geral ?? "N/A"}/10\n\n📝 **Resumo:** ${r.resumo_executivo || "N/A"}\n\n`
          if (r.pontos_fortes?.length) msg += `✅ **Pontos Fortes:**\n${r.pontos_fortes.map((p: string) => `• ${p}`).join("\n")}\n\n`
          if (r.problemas?.length) {
            msg += `⚠️ **Problemas Identificados:**\n`
            msg += r.problemas.map((p: { titulo: string; descricao: string; gravidade: string }) => `• [${p.gravidade?.toUpperCase()}] ${p.titulo}: ${p.descricao}`).join("\n")
            msg += "\n\n"
          }
          if (r.recomendacoes?.length) msg += `💡 **Recomendações Prioritárias:**\n${r.recomendacoes.slice(0, 5).map((rec: { acao: string; impacto: string }) => `• ${rec.acao} → ${rec.impacto}`).join("\n")}`
          return { ok: true, mensagem: msg }
        } catch (e) { return { ok: false, mensagem: formatIaError(e) } }
      }

      case "sugerir_melhorias": {
        try {
          const [tRes, pRes, fRes, gRes] = await Promise.all([
            supabase.from("turmas").select("*").eq("escola_id", escolaId),
            supabase.from("professores").select("*").eq("escola_id", escolaId),
            supabase.from("faltas").select("*").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(30),
            supabase.from("grade_horarios").select("*").eq("escola_id", escolaId),
          ])
          const apiRes = await fetch("/api/ia/melhorias", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turmas: tRes.data || [], professores: pRes.data || [], faltas: fRes.data || [], grade: gRes.data || [] }),
          })
          const resultado = await apiRes.json()
          if (!apiRes.ok) return { ok: false, mensagem: resultado.error || formatIaError("Erro") }
          const r = resultado as any
          let msg = `**🌟 Sugestões de Melhoria**\n\n`
          if (r.melhorias?.length) {
            r.melhorias.slice(0, 8).forEach((m: any, i: number) => {
              const emoji = m.urgencia === "imediata" ? "🔴" : m.urgencia === "esta_semana" ? "🟡" : "🟢"
              msg += `${i + 1}. ${emoji} **${m.titulo}**\n   ${m.descricao}\n`
              if (m.acao_recomendada) msg += `   💬 _"${m.acao_recomendada}"_\n\n`
            })
          } else {
            return { ok: false, mensagem: "A IA não retornou sugestões de melhoria. Tente novamente." }
          }
          return { ok: true, mensagem: msg }
        } catch (e) { return { ok: false, mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}` } }
      }

      case "relatorio_professor": {
        const nome = params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase.from("professores").select("*").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const prof = profs[0]
        const [fRes, sRes, gRes] = await Promise.all([
          supabase.from("faltas").select("*").eq("escola_id", escolaId).eq("professor_id", prof.id),
          supabase.from("substituicoes").select("*").eq("escola_id", escolaId).eq("professor_substituto_id", prof.id),
          supabase.from("grade_horarios").select("*").eq("escola_id", escolaId).eq("professor_id", prof.id),
        ])
        const apiRes = await fetch("/api/ia/relatorio-professor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professor: prof, faltas: fRes.data || [], substituicoes: sRes.data || [], aulas: gRes.data || [] }) })
        const r = await apiRes.json()
        if (!apiRes.ok) return { ok: false, mensagem: r.error || formatIaError("Erro ao gerar relatório") }
        const rel = r as any
        let msg = `**📋 Relatório: ${rel.nome || prof.nome}**\n\n${rel.resumo || ""}\n\n📊 **Indicadores (IA):**\n• Faltas: ${rel.total_faltas ?? fRes.data?.length ?? 0}\n• Substituições: ${rel.total_substituicoes_realizadas ?? sRes.data?.length ?? 0}\n• Aulas na grade: ${rel.total_aulas ?? gRes.data?.length ?? 0}\n`
        if (rel.frequencia_percent != null) msg += `• Frequência: ${rel.frequencia_percent}%\n`
        if (rel.avaliacao) msg += `• Avaliação: **${rel.avaliacao}**\n`
        if (rel.pontos_positivos?.length) msg += `\n✅ **Pontos positivos:**\n${rel.pontos_positivos.map((p: string) => `• ${p}`).join("\n")}\n`
        if (rel.pontos_atencao?.length) msg += `\n⚠️ **Pontos de atenção:**\n${rel.pontos_atencao.map((p: string) => `• ${p}`).join("\n")}\n`
        if (rel.recomendacao) msg += `\n💡 **Recomendação:** ${rel.recomendacao}`
        return { ok: true, mensagem: msg }
      }

      case "prever_faltas": {
        const { data: professores } = await supabase.from("professores").select("id, nome, status").eq("escola_id", escolaId)
        const { data: faltas } = await supabase.from("faltas").select("professor_id, data, motivo, status").eq("escola_id", escolaId).order("data", { ascending: false }).limit(100)
        if (!professores?.length) return { ok: false, mensagem: "Nenhum professor cadastrado." }
        if (!faltas?.length) return { ok: false, mensagem: "Nenhum histórico de faltas para a IA analisar padrões." }
        const historicoProf = professores.map((p) => ({ ...p, faltas: faltas.filter((f) => f.professor_id === p.id) }))
        const apiRes = await fetch("/api/ia/prever-faltas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ historicoProfessores: historicoProf, diasSemana: ["segunda", "terça", "quarta", "quinta", "sexta"] }) })
        const resultado = await apiRes.json()
        if (!apiRes.ok) return { ok: false, mensagem: resultado.error || formatIaError("Erro na previsão") }
        const prev = resultado as any
        let msg = `**🔮 Previsão de Faltas (IA)**\n\n`
        if (prev.alerta) msg += `⚠️ ${prev.alerta}\n\n`
        if (prev.padrao_geral) msg += `📈 **Padrão geral:** ${prev.padrao_geral}\n\n`
        if (prev.previsoes?.length) {
          msg += prev.previsoes.slice(0, 10).map((p: any) => `• **${p.professor_nome}** — risco **${p.risco}**` + (p.probabilidade_percent != null ? ` (${p.probabilidade_percent}%)` : "") + (p.motivo_inferido ? `\n  _${p.motivo_inferido}_` : "") + (p.recomendacao ? `\n  💡 ${p.recomendacao}` : "")).join("\n\n")
        } else {
          return { ok: false, mensagem: "A IA não retornou previsões. Tente novamente." }
        }
        return { ok: true, mensagem: msg }
      }

      case "responder_pergunta": {
        const pergunta = params.pergunta || params.texto || params.query
        if (!pergunta) return { ok: false, mensagem: "Informe a pergunta." }
        const [tRes, pRes] = await Promise.all([
          supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId).limit(20),
          supabase.from("professores").select("id, nome, status, especialidades").eq("escola_id", escolaId).limit(20),
        ])
        const apiRes = await fetch("/api/ia/pergunta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pergunta, contexto: { turmas: tRes.data || [], professores: pRes.data || [] } }) })
        const resultado = await apiRes.json()
        if (!apiRes.ok) return { ok: false, mensagem: resultado.error || "Erro" }
        return { ok: true, mensagem: (resultado as { resposta?: string }).resposta || "Sem resposta." }
      }

      case "status_sistema": {
        const [tRes, pRes, mRes, sRes, fRes, gRes] = await Promise.all([
          supabase.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("professores").select("id,status").eq("escola_id", escolaId),
          supabase.from("materias").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("series").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("faltas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("data", new Date().toISOString().split("T")[0]),
          supabase.from("grade_horarios").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
        ])
        const presentes = pRes.data?.filter((p) => p.status === "presente").length || 0
        const ausentes = pRes.data?.filter((p) => p.status !== "presente").length || 0
        const total = pRes.data?.length || 0
        return { ok: true, mensagem: `**📊 Status Geral da Escola**\n\n🏫 Turmas: ${tRes.count || 0}\n👥 Professores: ${total} (${presentes} ✅ presentes, ${ausentes} ❌ ausentes)\n📚 Matérias: ${mRes.count || 0}\n🎓 Séries: ${sRes.count || 0}\n📋 Faltas hoje: ${fRes.count || 0}\n📅 Aulas na grade: ${gRes.count || 0}` }
      }

      case "listar_professores": {
        const { data } = await supabase.from("professores").select("nome, especialidades, status, carga_horaria").eq("escola_id", escolaId).order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhum professor cadastrado ainda." }
        const presentes = data.filter((p) => p.status === "presente").length
        const ausentes = data.length - presentes
        const lista = data.map((p) => {
          const statusEmoji = p.status === "presente" ? "🟢" : p.status === "ausente" ? "🔴" : p.status === "ferias" ? "🏖️" : "🟡"
          const esp = (p.especialidades || []).join(", ") || "sem especialidade"
          return `${statusEmoji} **${p.nome}** - ${esp} (${p.carga_horaria}h)`
        }).join("\n")
        return { ok: true, mensagem: `**👥 Professores (${data.length}) — ${presentes} presentes, ${ausentes} ausentes:**\n\n${lista}` }
      }

      case "listar_turmas": {
        const { data } = await supabase.from("turmas").select("nome, periodo, serie:series(nome)").eq("escola_id", escolaId).order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma turma cadastrada ainda." }
        const porPeriodo = { manha: data.filter((t) => t.periodo === "manha"), tarde: data.filter((t) => t.periodo === "tarde"), integral: data.filter((t) => t.periodo === "integral") }
        let msg = `**🏫 Turmas (${data.length}):**\n\n`
        if (porPeriodo.manha.length) msg += `🌅 **Manhã (${porPeriodo.manha.length}):** ${porPeriodo.manha.map((t) => t.nome).join(", ")}\n`
        if (porPeriodo.tarde.length) msg += `🌆 **Tarde (${porPeriodo.tarde.length}):** ${porPeriodo.tarde.map((t) => t.nome).join(", ")}\n`
        if (porPeriodo.integral.length) msg += `📚 **Integral (${porPeriodo.integral.length}):** ${porPeriodo.integral.map((t) => t.nome).join(", ")}\n`
        return { ok: true, mensagem: msg }
      }

      case "listar_materias": {
        const { data } = await supabase.from("materias").select("nome, cor").eq("escola_id", escolaId).order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma matéria cadastrada ainda." }
        return { ok: true, mensagem: `**📚 Matérias (${data.length}):**\n\n${data.map((m) => `• ${m.nome}`).join("\n")}` }
      }

      case "listar_periodos": {
        const { data } = await supabase.from("periodos").select("*").eq("escola_id", escolaId).order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhum período cadastrado." }
        const lista = data.map((p) => `• **${p.nome}** (${p.tipo}) — ${p.hora_inicio} às ${p.hora_fim}`).join("\n")
        return { ok: true, mensagem: `**⏰ Períodos (${data.length}):**\n\n${lista}` }
      }

      case "listar_series": {
        const { data } = await supabase.from("series").select("*").eq("escola_id", escolaId).order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma série cadastrada." }
        return { ok: true, mensagem: `**🎓 Séries:**\n\n${data.map((s) => `• ${s.nome} (ordem ${s.ordem})`).join("\n")}` }
      }

      case "listar_disponiveis": {
        const { data } = await supabase.from("professores").select("nome, especialidades, carga_horaria").eq("escola_id", escolaId).eq("status", "presente").order("nome")
        if (!data?.length) return { ok: true, mensagem: "⚠️ Nenhum professor disponível no momento." }
        const lista = data.map((p) => `🟢 **${p.nome}** — ${(p.especialidades || []).join(", ") || "geral"} (${p.carga_horaria}h)`).join("\n")
        return { ok: true, mensagem: `**✅ Disponíveis (${data.length}):**\n\n${lista}` }
      }

      case "professores_por_especialidade": {
        const esp = (params.especialidade || params.nome || "").toLowerCase()
        const { data } = await supabase.from("professores").select("nome, especialidades, status").eq("escola_id", escolaId)
        const filtrados = esp ? data?.filter((p) => p.especialidades?.some((e: string) => e.toLowerCase().includes(esp))) : data
        if (!filtrados?.length) return { ok: true, mensagem: esp ? `Nenhum professor com especialidade "${esp}".` : "Nenhum professor cadastrado." }
        const lista = filtrados.map((p) => {
          const statusEmoji = p.status === "presente" ? "🟢" : p.status === "ausente" ? "🔴" : "🟡"
          return `${statusEmoji} **${p.nome}** [${(p.especialidades || []).join(", ")}]`
        }).join("\n")
        return { ok: true, mensagem: `**${esp ? `Professores de ${esp}` : "Todos os Professores"} (${filtrados.length}):**\n\n${lista}` }
      }

      case "resumo_semanal": {
        const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const [tRes, pRes, fRes, sRes, eRes, gRes] = await Promise.all([
          supabase.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("professores").select("id, status").eq("escola_id", escolaId),
          supabase.from("faltas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).gte("data", semanaAtras),
          supabase.from("substituicoes").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("status", "pendente"),
          supabase.from("eventos_tempo_real").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).gte("created_at", semanaAtras),
          supabase.from("grade_horarios").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
        ])
        const presentes = pRes.data?.filter((p) => p.status === "presente").length || 0
        const ausentes = pRes.data?.filter((p) => p.status !== "presente").length || 0
        const scorePresenca = pRes.data?.length ? Math.round((presentes / pRes.data.length) * 100) : 0
        return {
          ok: true,
          mensagem: `**📊 Resumo Semanal**\n\n🏫 Turmas: ${tRes.count || 0}\n👥 Professores: ${pRes.data?.length || 0}\n  ✅ Presentes: ${presentes} (${scorePresenca}%)\n  ❌ Ausentes: ${ausentes}\n📋 Faltas (7 dias): ${fRes.count || 0}\n🔄 Substituições pendentes: ${sRes.count || 0}\n📅 Aulas na grade: ${gRes.count || 0}\n📌 Eventos (7 dias): ${eRes.count || 0}\n\n${scorePresenca >= 80 ? "🌟 Semana com boa frequência!" : scorePresenca >= 60 ? "⚡ Frequência moderada, fique atento." : "⚠️ Frequência baixa — considere ações!"}`,
        }
      }

      default:
        return { ok: false, mensagem: `Ação "${acao}" não reconhecida pelo sistema.` }
    }
  }

  const handleSugestao = useCallback((texto: string) => {
    setInput(texto)
    setShowSugestoes(false)
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() && !anexo) return

    const textoUsuario = input.trim()
    setInput("")
    setShowSugestoes(false)
    addMensagem({ role: "user", content: textoUsuario || `[Anexo: ${anexo?.name}]` })
    setLoading(true)
    setIsTyping(true)

    try {
      if (anexo) {
        const formData = new FormData()
        formData.append("file", anexo)
        formData.append("professor", textoUsuario)
        const upRes = await fetch("/api/upload", { method: "POST", body: formData })
        const upData = await upRes.json().catch(() => ({}))
        if (!upRes.ok) {
          addMensagem({ role: "assistant", content: `❌ ${upData.error || "Erro ao enviar o arquivo."}`, isError: true })
          setLoading(false)
          setIsTyping(false)
          return
        }
        if (upData.faltaRegistrada) {
          addMensagem({ role: "assistant", content: `✅ ${upData.message || "Atestado enviado e falta registrada!"}` })
        }
        setAnexo(null)
        if (!textoUsuario.trim()) {
          setLoading(false)
          setIsTyping(false)
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      let contexto: any = {}
      if (user) {
        try {
          const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
          const eId = await getCurrentEscolaId(user.id)
          contexto = { escolaId: eId }
        } catch {}
      }

      // Enrich with current page and basic stats for richer LLM context (praticidade de entender o contexto atual)
      if (typeof window !== "undefined") {
        contexto.currentPage = window.location.pathname
        // Could pass more like current stats from parent context in future
      }

      const historico = mensagens.filter((m) => m.role === "user" || m.role === "assistant").slice(-12).map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 900) }))

      const res = await fetch("/api/ia/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comando: textoUsuario, contexto, historico }),
      })

      const data = await res.json()

      if (data.acao === "responder_pergunta" && (data.resposta || data.params?.resposta)) {
        addMensagem({ role: "assistant", content: data.resposta || data.params.resposta, acao: data.acao })
        setLoading(false)
        setIsTyping(false)
        return
      }

      if (!data.acao || data.acao === "desconhecido" || data.acao === "erro") {
        addMensagem({ role: "assistant", content: data.resposta || data.mensagem || '❓ Não entendi.', isError: data.acao === "erro" })
        setLoading(false)
        setIsTyping(false)
        return
      }

      const acaoExec = normalizarAcaoComando(data.acao) || data.acao
      const paramsNorm = normalizarParamsComando(acaoExec, { ...(data.params || {}), _comando: textoUsuario }, textoUsuario)
      const resultado = await executarAcao(acaoExec, paramsNorm)
      const emoji = resultado.ok ? "✅" : "❌"
      addMensagem({ role: "assistant", content: `${emoji} ${resultado.mensagem || "Comando executado!"}`, acao: acaoExec, isError: !resultado.ok })

      if (resultado.ok) {
        fetch("/api/ia/memoria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fato: `${textoUsuario.slice(0, 150)} → ${resultado.mensagem.slice(0, 200)}`, acao: data.acao }) }).catch(() => {})
      }
    } catch (err) {
      addMensagem({ role: "assistant", content: `❌ ${formatIaError(err)}`, isError: true })
    } finally {
      setLoading(false)
      setIsTyping(false)
    }
  }

  // Simple rich text renderer for IA responses (supports **bold**, • lists, newlines)
  function renderMessage(content: string, isUser: boolean) {
    const lines = content.split("\n")
    return lines.map((line, idx) => {
      if (!line.trim()) return <div key={idx} className="h-1" />

      // Bold **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      const rendered = parts.map((part, pIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pIdx} className="font-semibold">{part.slice(2, -2)}</strong>
        }
        return part
      })

      const isList = line.trim().startsWith("•") || line.trim().startsWith("- ")
      return (
        <div key={idx} className={isList ? "pl-1" : ""}>
          {rendered}
        </div>
      )
    })
  }

  // Copy assistant message
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const copyMessage = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1400)
    } catch {}
  }

  const floatingUi = (
    <>
      {aberto && (
        <div
          ref={panelRef}
          className="aria-chat-panel fixed z-[9998] flex flex-col overflow-hidden rounded-[var(--aria-radius-lg)] border shadow-2xl"
          style={{
            bottom: "1.25rem",
            right: "1.25rem",
            width: "min(400px, calc(100vw - 2rem))",
            height: "min(520px, calc(100dvh - 5rem))",
            background: "var(--aria-surface)",
            borderColor: "var(--aria-border-strong)",
            boxShadow: "var(--aria-shadow), 0 0 0 1px rgba(34,211,238,0.06)",
          }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--aria-border)" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--aria-accent-soft)", color: "var(--aria-accent)" }}>
                <Brain className="h-4.5 w-4.5" strokeWidth={2.25} />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[0.5px]" style={{ color: "var(--aria-text)" }}>ARIA</div>
                <div className="text-[10px] leading-none" style={{ color: "var(--aria-text-subtle)" }}>Assistente da escola</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSugestoes((s) => !s)}
                className="rounded-lg p-1.5 transition hover:bg-white/5"
                title="Sugestões rápidas"
                style={{ color: "var(--aria-text-muted)" }}
              >
                <Lightbulb className="h-4 w-4" />
              </button>
              <button
                onClick={limpar}
                className="rounded-lg p-1.5 transition hover:bg-white/5"
                title="Limpar conversa"
                style={{ color: "var(--aria-text-muted)" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAberto(false)}
                className="rounded-lg p-1.5 transition hover:bg-white/5"
                style={{ color: "var(--aria-text-muted)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick suggestions */}
          {showSugestoes && (
            <div className="shrink-0 border-b px-3 py-2.5" style={{ borderColor: "var(--aria-border)", background: "var(--aria-accent-soft)" }}>
              <div className="mb-1.5 px-1 text-[10px] font-medium tracking-widest" style={{ color: "var(--aria-accent)" }}>SUGESTÕES</div>
              <div className="flex flex-wrap gap-1.5">
                {sugestoesRapidas.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSugestao(s.replace(/^[^\s]+\s/, ""))}
                    className="rounded-full border px-2.5 py-px text-xs transition hover:scale-[1.02]"
                    style={{
                      borderColor: "var(--aria-border-strong)",
                      background: "var(--aria-surface)",
                      color: "var(--aria-text-muted)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto space-y-2 p-3 text-[13.5px] leading-relaxed"
            style={{ background: "var(--aria-bg-elevated)" }}
          >
            {mensagens.length === 0 && (
              <div className="mt-6 px-4 text-center text-xs" style={{ color: "var(--aria-text-subtle)" }}>
                Olá! Sou a ARIA.<br />Peça análises, relatórios ou sugestões. Eu não altero nada sozinha.
              </div>
            )}

            {mensagens.map((m, i) => {
              const isUser = m.role === "user"
              return (
                <div key={i} className={`group flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`relative max-w-[82%] rounded-2xl px-3.5 py-2 shadow-sm ${isUser ? "text-[#050508]" : ""}`}
                    style={{
                      background: isUser ? "var(--aria-accent)" : "var(--aria-surface)",
                      color: isUser ? "#050508" : "var(--aria-text)",
                      border: isUser ? "none" : "1px solid var(--aria-border)",
                    }}
                  >
                    {renderMessage(m.content, isUser)}
                    {m.isError && <span className="mt-1 block text-[10px] opacity-60">Erro ao processar</span>}

                    {!isUser && (
                      <button
                        onClick={() => copyMessage(m.content, i)}
                        className="absolute -right-1 -top-1 hidden rounded-md bg-black/40 p-1 text-white opacity-0 transition group-hover:block group-hover:opacity-100"
                        title="Copiar"
                      >
                        {copiedIdx === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3.5 py-2 text-xs" style={{ background: "var(--aria-surface)", color: "var(--aria-text-muted)" }}>
                  <span className="inline-flex gap-1">
                    <span className="animate-pulse">●</span>
                    <span className="animate-pulse delay-150">●</span>
                    <span className="animate-pulse delay-300">●</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t p-2.5"
            style={{ borderColor: "var(--aria-border)", background: "var(--aria-surface)" }}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-white/5"
                title="Anexar atestado"
                style={{ color: "var(--aria-accent)" }}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setAnexo(e.target.files?.[0] || null)}
              />

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setShowSugestoes(false)}
                placeholder="Pergunte algo à ARIA…"
                className="flex-1 rounded-2xl border bg-transparent px-3.5 py-2 text-sm outline-none placeholder:text-[var(--aria-text-subtle)]"
                style={{ borderColor: "var(--aria-border)" }}
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || (!input.trim() && !anexo)}
                className="flex h-9 w-9 items-center justify-center rounded-2xl transition disabled:opacity-40"
                style={{ background: "var(--aria-accent)", color: "#050508" }}
                title="Enviar"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {anexo && (
              <div className="mt-1.5 flex items-center gap-1 px-1 text-[11px]" style={{ color: "var(--aria-text-muted)" }}>
                <Paperclip className="h-3 w-3" /> {anexo.name}
                <button type="button" onClick={() => setAnexo(null)} className="ml-1 underline">remover</button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  )

  if (!portalReady || typeof document === "undefined") return null
  if (!aberto) return null
  return createPortal(floatingUi, document.body)
}