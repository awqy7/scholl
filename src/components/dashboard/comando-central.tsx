"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  consumirPedidoAbrirChat,
  esconderFabAria,
  mostrarFabAria,
} from "@/components/dashboard/aria-floating-button"
import { useChat } from "@/lib/chat-context"
import { createClient } from "@/lib/supabase/client"
import { persistGradeHorarios, persistRecreioIntercalado } from "@/lib/persist-ia"
import { garantirDadosEscola } from "@/lib/escola-setup"
import { formatIaError } from "@/lib/ia-utils"
import {
  SUGESTOES_RAPIDAS,
  gerarNomesTurmas,
  normalizarAcaoComando,
  normalizarParamsComando,
  resolverProfessoresParaCadastro,
  resolverListaNomesCadastro,
} from "@/lib/ia-comando"
import { useEscola } from "@/lib/escola-context"
import {
  escolaTemRecreioIntercalado,
  mensagemRecursoIndisponivel,
} from "@/lib/escola-tipo"
import {
  Bot, Send, X, Loader2, Paperclip, Trash2,
  ChevronDown, Brain, AlertCircle, Lightbulb
} from "lucide-react"
import type { Mensagem } from "@/lib/chat-context"

function nomeRelacao(rel: unknown): string {
  if (!rel) return "?"
  if (Array.isArray(rel)) return (rel[0] as { nome?: string })?.nome || "?"
  return (rel as { nome?: string }).nome || "?"
}

function MensagemBubble({ msg }: { msg: Mensagem }) {
  const isUser = msg.role === "user"

  function renderContent(content: string) {
    // Renderiza markdown básico
    const lines = content.split("\n")
    return lines.map((line, i) => {
      // Bold com **texto**
      const parts = line.split(/(\*\*[^*]+\*\*)/)
      const rendered = parts.map((p, j) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={j}>{p.slice(2, -2)}</strong>
        }
        return p
      })
      const isHeader = line.startsWith("**") && line.endsWith("**")
      return (
        <span key={i} className={`block ${isHeader ? "mt-1" : ""} ${i > 0 && !line ? "mt-1" : ""}`}>
          {rendered}
        </span>
      )
    })
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser && (
        <div className="mr-2 mt-1 flex-shrink-0">
          <Brain className="w-4 h-4" style={{ color: "var(--aria-accent)" }} strokeWidth={2} />
        </div>
      )}
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
        ${isUser
          ? "rounded-br-sm text-white"
          : "rounded-bl-sm"
        }
        ${msg.isError ? "border border-red-500/30" : ""}
      `}
        style={isUser
          ? {
              background: "linear-gradient(135deg, rgba(34,211,238,0.85), rgba(99,102,241,0.9))",
            }
          : {
              backgroundColor: "var(--aria-surface)",
              border: "1px solid var(--aria-border)",
            }
        }
      >
        <div className={`text-sm ${isUser ? "text-white" : "text-gray-100"}`}>
          {renderContent(msg.content)}
        </div>
        <div className={`text-xs mt-1 ${isUser ? "text-indigo-200" : "text-gray-500"} opacity-70`}>
          {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          {msg.acao && !isUser && (
            <span className="ml-2 text-indigo-400">
              ⚡ {msg.acao.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="mr-2 mt-1 flex-shrink-0">
        <Brain className="w-4 h-4" style={{ color: "var(--aria-accent)" }} strokeWidth={2} />
      </div>
      <div
        className="rounded-2xl rounded-bl-sm px-4 py-3"
        style={{
          backgroundColor: "var(--aria-surface)",
          border: "1px solid var(--aria-border)",
        }}
      >
        <div className="flex gap-1 items-center">
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: "var(--aria-accent)", animationDelay: "0ms" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: "var(--aria-accent)", animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ backgroundColor: "var(--aria-accent)", animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  )
}

export function ComandoCentral() {
  const { tipo: tipoEscola, config: configEscola } = useEscola()
  const { mensagens, addMensagem, updateLastMessage, limpar, isTyping, setIsTyping } = useChat()
  const sugestoesRapidas = configEscola.sugestoesAria.length
    ? configEscola.sugestoesAria
    : SUGESTOES_RAPIDAS
  const [aberto, setAberto] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [anexo, setAnexo] = useState<File | null>(null)
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [hasNewMsg, setHasNewMsg] = useState(false)
  const [portalReady, setPortalReady] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    function abrir() {
      setAberto(true)
    }
    window.addEventListener("aria:abrir-chat", abrir)
    if (consumirPedidoAbrirChat()) setAberto(true)
    return () => window.removeEventListener("aria:abrir-chat", abrir)
  }, [])

  useEffect(() => {
    if (aberto) esconderFabAria()
    else mostrarFabAria()
  }, [aberto])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
    if (!aberto && mensagens.length > 1) {
      setHasNewMsg(true)
    }
  }, [mensagens, aberto])

  useEffect(() => {
    if (aberto) {
      setHasNewMsg(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return

    function fecharSeFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (panelRef.current?.contains(alvo)) return
      const fab = document.getElementById("aria-fab-launcher")
      if (fab?.contains(alvo)) return
      setAberto(false)
      setShowSugestoes(false)
    }

    function fecharEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAberto(false)
        setShowSugestoes(false)
      }
    }

    document.addEventListener("mousedown", fecharSeFora)
    document.addEventListener("keydown", fecharEscape)
    return () => {
      document.removeEventListener("mousedown", fecharSeFora)
      document.removeEventListener("keydown", fecharEscape)
    }
  }, [aberto])

  async function garantirEscola(escolaId: string) {
    const { data: existing } = await supabase
      .from("escolas")
      .select("id")
      .eq("id", escolaId)
      .maybeSingle()
    if (!existing) {
      const { error } = await supabase
        .from("escolas")
        .insert({ id: escolaId, nome: "Minha Escola", tipo: tipoEscola })
      if (error && error.code !== "23505") throw error
    }
  }

  async function resolverSerieId(
    escolaId: string,
    serieNome?: string
  ): Promise<string | null> {
    if (!serieNome?.trim()) return null
    const nome = serieNome.trim()
    const { data: series } = await supabase
      .from("series")
      .select("id, nome")
      .eq("escola_id", escolaId)

    const norm = nome.toLowerCase()
    const match = series?.find(
      (s) =>
        s.nome.toLowerCase() === norm ||
        s.nome.toLowerCase().includes(norm) ||
        norm.includes(s.nome.toLowerCase())
    )
    if (match) return match.id

    const { data: created, error } = await supabase
      .from("series")
      .insert({ escola_id: escolaId, nome, ordem: (series?.length || 0) + 1 })
      .select("id")
      .single()
    if (error) return null
    return created?.id ?? null
  }

  async function getContexto(escolaId: string) {
    const [tRes, pRes, mRes, pNomes] = await Promise.all([
      supabase.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
      supabase.from("professores").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
      supabase.from("materias").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
      supabase.from("professores").select("nome").eq("escola_id", escolaId).order("nome").limit(40),
    ])
    return {
      tipoEscola,
      turmas: tRes.count || 0,
      professores: pRes.count || 0,
      materias: mRes.count || 0,
      nomesProfessores: (pNomes.data || []).map((p) => p.nome),
      horaAtual: new Date().toLocaleTimeString("pt-BR"),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function executarAcao(acao: string, params: any): Promise<{ ok: boolean; mensagem: string }> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, mensagem: "Usuário não autenticado" }
    const escolaId = user.id

    try {
      await garantirEscola(escolaId)
    } catch {
      return { ok: false, mensagem: "Erro ao garantir escola no banco" }
    }

    switch (acao) {
      // ========== ANALÍTICOS (novos) ==========
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
            body: JSON.stringify({
              turmas: tRes.data || [],
              professores: pRes.data || [],
              materias: mRes.data || [],
              faltas: fRes.data || [],
              substituicoes: sRes.data || [],
              grade: gRes.data || [],
            }),
          })

          const resultado = await apiRes.json()
          if (!apiRes.ok) {
            return { ok: false, mensagem: resultado.error || formatIaError("Erro na análise") }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = resultado as any
          let msg = `**🎯 Análise Completa da Escola**\n\n`
          msg += `📊 **Nota Geral:** ${r.nota_geral ?? "N/A"}/10\n\n`
          msg += `📝 **Resumo:** ${r.resumo_executivo || "N/A"}\n\n`

          if (r.pontos_fortes?.length) {
            msg += `✅ **Pontos Fortes:**\n${r.pontos_fortes.map((p: string) => `• ${p}`).join("\n")}\n\n`
          }

          if (r.problemas?.length) {
            msg += `⚠️ **Problemas Identificados:**\n`
            msg += r.problemas.map((p: { titulo: string; descricao: string; gravidade: string }) =>
              `• [${p.gravidade?.toUpperCase()}] ${p.titulo}: ${p.descricao}`
            ).join("\n")
            msg += "\n\n"
          }

          if (r.recomendacoes?.length) {
            msg += `💡 **Recomendações Prioritárias:**\n`
            msg += r.recomendacoes.slice(0, 5).map((rec: { acao: string; impacto: string }) =>
              `• ${rec.acao} → ${rec.impacto}`
            ).join("\n")
          }

          return { ok: true, mensagem: msg }
        } catch (e) {
          return { ok: false, mensagem: formatIaError(e) }
        }
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
            body: JSON.stringify({
              turmas: tRes.data || [],
              professores: pRes.data || [],
              faltas: fRes.data || [],
              grade: gRes.data || [],
            }),
          })

          const resultado = await apiRes.json()
          if (!apiRes.ok) {
            return { ok: false, mensagem: resultado.error || formatIaError("Erro") }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const r = resultado as any
          let msg = `**🌟 Sugestões de Melhoria**\n\n`

          if (r.melhorias?.length) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            r.melhorias.slice(0, 8).forEach((m: any, i: number) => {
              const emoji = m.urgencia === "imediata" ? "🔴" : m.urgencia === "esta_semana" ? "🟡" : "🟢"
              msg += `${i + 1}. ${emoji} **${m.titulo}**\n`
              msg += `   ${m.descricao}\n`
              if (m.acao_recomendada) msg += `   💬 _"${m.acao_recomendada}"_\n`
              msg += "\n"
            })
          } else {
            return {
              ok: false,
              mensagem: "A IA não retornou sugestões de melhoria. Tente novamente.",
            }
          }

          return { ok: true, mensagem: msg }
        } catch (e) {
          return { ok: false, mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}` }
        }
      }

      case "relatorio_professor": {
        const nome = params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }

        const { data: profs } = await supabase
          .from("professores")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
          .limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }

        const prof = profs[0]
        const [fRes, sRes, gRes] = await Promise.all([
          supabase.from("faltas").select("*").eq("escola_id", escolaId).eq("professor_id", prof.id),
          supabase.from("substituicoes").select("*").eq("escola_id", escolaId).eq("professor_substituto_id", prof.id),
          supabase.from("grade_horarios").select("*").eq("escola_id", escolaId).eq("professor_id", prof.id),
        ])

        const apiRes = await fetch("/api/ia/relatorio-professor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professor: prof,
            faltas: fRes.data || [],
            substituicoes: sRes.data || [],
            aulas: gRes.data || [],
          }),
        })

        const r = await apiRes.json()
        if (!apiRes.ok) {
          return { ok: false, mensagem: r.error || formatIaError("Erro ao gerar relatório") }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rel = r as any
        let msg = `**📋 Relatório: ${rel.nome || prof.nome}**\n\n`
        msg += `${rel.resumo || ""}\n\n`
        msg += `📊 **Indicadores (IA):**\n`
        msg += `• Faltas: ${rel.total_faltas ?? fRes.data?.length ?? 0}\n`
        msg += `• Substituições: ${rel.total_substituicoes_realizadas ?? sRes.data?.length ?? 0}\n`
        msg += `• Aulas na grade: ${rel.total_aulas ?? gRes.data?.length ?? 0}\n`
        if (rel.frequencia_percent != null) {
          msg += `• Frequência: ${rel.frequencia_percent}%\n`
        }
        if (rel.avaliacao) msg += `• Avaliação: **${rel.avaliacao}**\n`
        if (rel.pontos_positivos?.length) {
          msg += `\n✅ **Pontos positivos:**\n${rel.pontos_positivos.map((p: string) => `• ${p}`).join("\n")}\n`
        }
        if (rel.pontos_atencao?.length) {
          msg += `\n⚠️ **Pontos de atenção:**\n${rel.pontos_atencao.map((p: string) => `• ${p}`).join("\n")}\n`
        }
        if (rel.recomendacao) msg += `\n💡 **Recomendação:** ${rel.recomendacao}`

        return { ok: true, mensagem: msg }
      }

      case "responder_pergunta": {
        const pergunta = params.pergunta || params.texto || params.query
        if (!pergunta) return { ok: false, mensagem: "Informe a pergunta." }

        const [tRes, pRes] = await Promise.all([
          supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId).limit(20),
          supabase.from("professores").select("id, nome, status, especialidades").eq("escola_id", escolaId).limit(20),
        ])

        const apiRes = await fetch("/api/ia/pergunta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pergunta,
            contexto: { turmas: tRes.data || [], professores: pRes.data || [] },
          }),
        })

        const resultado = await apiRes.json()
        if (!apiRes.ok) return { ok: false, mensagem: resultado.error || "Erro" }

        return { ok: true, mensagem: (resultado as { resposta?: string }).resposta || "Sem resposta." }
      }

      case "prever_faltas": {
        const { data: professores } = await supabase
          .from("professores")
          .select("id, nome, status")
          .eq("escola_id", escolaId)

        const { data: faltas } = await supabase
          .from("faltas")
          .select("professor_id, data, motivo, status")
          .eq("escola_id", escolaId)
          .order("data", { ascending: false })
          .limit(100)

        if (!professores?.length) return { ok: false, mensagem: "Nenhum professor cadastrado." }
        if (!faltas?.length) {
          return {
            ok: false,
            mensagem: "Nenhum histórico de faltas para a IA analisar padrões.",
          }
        }

        const historicoProf = professores.map((p) => ({
          ...p,
          faltas: faltas.filter((f) => f.professor_id === p.id),
        }))

        const apiRes = await fetch("/api/ia/prever-faltas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            historicoProfessores: historicoProf,
            diasSemana: ["segunda", "terça", "quarta", "quinta", "sexta"],
          }),
        })

        const resultado = await apiRes.json()
        if (!apiRes.ok) {
          return { ok: false, mensagem: resultado.error || formatIaError("Erro na previsão") }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prev = resultado as any
        let msg = `**🔮 Previsão de Faltas (IA)**\n\n`
        if (prev.alerta) msg += `⚠️ ${prev.alerta}\n\n`
        if (prev.padrao_geral) msg += `📈 **Padrão geral:** ${prev.padrao_geral}\n\n`
        if (prev.previsoes?.length) {
          msg += prev.previsoes
            .slice(0, 10)
            .map(
              (p: {
                professor_nome: string
                risco: string
                probabilidade_percent?: number
                motivo_inferido?: string
                recomendacao?: string
              }) =>
                `• **${p.professor_nome}** — risco **${p.risco}**` +
                (p.probabilidade_percent != null ? ` (${p.probabilidade_percent}%)` : "") +
                (p.motivo_inferido ? `\n  _${p.motivo_inferido}_` : "") +
                (p.recomendacao ? `\n  💡 ${p.recomendacao}` : "")
            )
            .join("\n\n")
        } else {
          return { ok: false, mensagem: "A IA não retornou previsões. Tente novamente." }
        }

        return { ok: true, mensagem: msg }
      }

      // ========== TURMAS ==========
      case "criar_turma": {
        const nomesTurma = resolverListaNomesCadastro(
          params,
          params._comando as string | undefined,
          "turma"
        )
        const nomes = nomesTurma.length ? nomesTurma : gerarNomesTurmas(params)
        const periodo = (params.periodo as string) || "manha"
        const serieNome = params.serie_nome || params.base_nome
        let serieId = params.serie_id as string | undefined
        if (!serieId && serieNome) {
          serieId = (await resolverSerieId(escolaId, String(serieNome))) || undefined
        }

        const criadas: string[] = []
        const erros: string[] = []

        for (const nome of nomes) {
          let sid = serieId
          if (!sid) {
            const parteSerie = nome.split(" ")[0]
            sid = (await resolverSerieId(escolaId, parteSerie)) || undefined
          }
          const { error } = await supabase.from("turmas").insert({
            escola_id: escolaId,
            nome,
            serie_id: sid || null,
            periodo,
          })
          if (error) erros.push(`• ${nome}: ${error.message}`)
          else criadas.push(nome)
        }

        if (!criadas.length) {
          return { ok: false, mensagem: `Erro ao criar turma(s):\n${erros.join("\n")}` }
        }

        const periodoLabel =
          periodo === "tarde" ? "tarde" : periodo === "integral" ? "integral" : "manhã"
        let msg =
          criadas.length === 1
            ? `✨ Turma **"${criadas[0]}"** criada no banco!`
            : `✨ **${criadas.length} turmas** criadas no banco:\n${criadas.map((n) => `• ${n}`).join("\n")}`
        msg += `\nPeríodo: ${periodoLabel}`
        if (erros.length) msg += `\n\n⚠️ Falhas:\n${erros.join("\n")}`
        return { ok: true, mensagem: msg }
      }

      case "criar_professor": {
        const lista = resolverProfessoresParaCadastro(
          params,
          params._comando as string | undefined
        )

        if (!lista.length) {
          return {
            ok: false,
            mensagem:
              'Informe os professores. Ex.: "crie 5 professores: Ana Silva, Bruno Costa, Carla Dias, Diego Lima e Elena Moura"',
          }
        }

        const criados: string[] = []
        const erros: string[] = []

        for (const prof of lista) {
          const emailGerado = `${prof.nome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, ".")}@escola.com`

          const { error } = await supabase.from("professores").insert({
            escola_id: escolaId,
            nome: prof.nome,
            email: prof.email || emailGerado,
            telefone: prof.telefone || "",
            especialidades: prof.especialidades || [],
            carga_horaria: prof.carga_horaria || 20,
            status: "presente",
          })
          if (error) erros.push(`• ${prof.nome}: ${error.message}`)
          else criados.push(prof.nome)
        }

        if (!criados.length) {
          return { ok: false, mensagem: `Erro ao cadastrar:\n${erros.join("\n")}` }
        }

        let msg =
          criados.length === 1
            ? `✨ Professor(a) **"${criados[0]}"** cadastrado(a) no banco!`
            : `✨ **${criados.length} professores** cadastrados:\n${criados.map((n) => `• ${n}`).join("\n")}`
        if (erros.length) msg += `\n\n⚠️ Falhas:\n${erros.join("\n")}`

        await supabase.from("eventos_tempo_real").insert({
          escola_id: escolaId,
          tipo: "alerta",
          mensagem: `ARIA cadastrou ${criados.length} professor(es) na escola`,
        })

        return { ok: true, mensagem: msg }
      }

      case "criar_materia": {
        const cores = ["#6366F1", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#8B5CF6"]
        const listaNomes = resolverListaNomesCadastro(
          params,
          params._comando as string | undefined,
          "materia"
        )

        if (!listaNomes.length) {
          return { ok: false, mensagem: "Informe o nome da matéria." }
        }

        const criadas: string[] = []
        const erros: string[] = []

        for (let i = 0; i < listaNomes.length; i++) {
          const nome = listaNomes[i]
          const { error } = await supabase.from("materias").insert({
            escola_id: escolaId,
            nome,
            cor: params.cor || cores[i % cores.length],
          })
          if (error) erros.push(`• ${nome}: ${error.message}`)
          else criadas.push(nome)
        }

        if (!criadas.length) {
          return { ok: false, mensagem: `Erro ao criar matéria(s):\n${erros.join("\n")}` }
        }

        let msg =
          criadas.length === 1
            ? `✨ Matéria **"${criadas[0]}"** criada no banco!`
            : `✨ **${criadas.length} matérias** criadas:\n${criadas.map((n) => `• ${n}`).join("\n")}`
        if (erros.length) msg += `\n\n⚠️ Falhas:\n${erros.join("\n")}`
        return { ok: true, mensagem: msg }
      }

      case "registrar_falta": {
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${params.professor_nome}%`)
        if (!profs?.length)
          return { ok: false, mensagem: `Professor "${params.professor_nome}" não encontrado.` }

        const prof = profs[0]
        const dataFalta = params.data || new Date().toISOString().split("T")[0]

        await supabase.from("professores").update({ status: "ausente" }).eq("id", prof.id)
        await supabase.from("faltas").insert({
          escola_id: escolaId,
          professor_id: prof.id,
          data: dataFalta,
          motivo: params.motivo || "Não informado",
          status: "justificada",
        })
        await supabase.from("eventos_tempo_real").insert({
          escola_id: escolaId,
          tipo: "falta",
          mensagem: `${prof.nome} registrou falta: ${params.motivo || "Não informado"}`,
          professor_id: prof.id,
        })

        let msg = `📋 Falta registrada para **${prof.nome}**!\nData: ${dataFalta}\nMotivo: ${params.motivo || "Não informado"}`

        const { data: disponiveis } = await supabase
          .from("professores")
          .select("id, nome, especialidades, carga_horaria, status")
          .eq("escola_id", escolaId)
          .eq("status", "presente")

        const candidatos = (disponiveis || []).filter((p) => p.id !== prof.id)
        if (!candidatos.length) {
          msg += "\n\n⚠️ Nenhum professor disponível para substituição no momento."
          return { ok: true, mensagem: msg }
        }

        const sugRes = await fetch("/api/ia/sugerir-substituto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professorAusente: prof,
            professoresDisponiveis: candidatos,
            materia: "",
            horario: null,
          }),
        })
        const sugestao = await sugRes.json()
        if (!sugRes.ok) {
          msg += `\n\n❌ IA não sugeriu substituto: ${sugestao.error || formatIaError("erro")}`
          return { ok: true, mensagem: msg }
        }

        const nomeIa = String(sugestao.substituto || "").toLowerCase().trim()
        const substituto =
          candidatos.find((p) => p.nome.toLowerCase() === nomeIa) ||
          (sugestao.substituto_id
            ? candidatos.find((p) => p.id === sugestao.substituto_id)
            : undefined)

        if (!substituto) {
          msg += `\n\n❌ A IA sugeriu "${sugestao.substituto || "?"}" mas não foi possível vincular no cadastro.`
          if (sugestao.justificativa) msg += `\n_${sugestao.justificativa}_`
          return { ok: true, mensagem: msg }
        }

        await supabase.from("substituicoes").insert({
          escola_id: escolaId,
          professor_original_id: prof.id,
          professor_substituto_id: substituto.id,
          data: dataFalta,
          status: "pendente",
        })
        await supabase.from("eventos_tempo_real").insert({
          escola_id: escolaId,
          tipo: "substituicao",
          mensagem: `${substituto.nome} designado como substituto de ${prof.nome} (IA)`,
        })
        msg += `\n\n🔄 **Substituto sugerido pela IA:** ${substituto.nome}`
        if (sugestao.justificativa) msg += `\n_${sugestao.justificativa}_`

        return { ok: true, mensagem: msg }
      }

      case "listar_professores": {
        const { data } = await supabase
          .from("professores")
          .select("nome, especialidades, status, carga_horaria")
          .eq("escola_id", escolaId)
          .order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhum professor cadastrado ainda." }

        const presentes = data.filter((p) => p.status === "presente").length
        const ausentes = data.length - presentes
        const lista = data
          .map((p) => {
            const statusEmoji =
              p.status === "presente" ? "🟢" :
              p.status === "ausente" ? "🔴" :
              p.status === "ferias" ? "🏖️" : "🟡"
            const esp = (p.especialidades || []).join(", ") || "sem especialidade"
            return `${statusEmoji} **${p.nome}** - ${esp} (${p.carga_horaria}h)`
          })
          .join("\n")

        return {
          ok: true,
          mensagem: `**👥 Professores (${data.length}) — ${presentes} presentes, ${ausentes} ausentes:**\n\n${lista}`,
        }
      }

      case "listar_turmas": {
        const { data } = await supabase
          .from("turmas")
          .select("nome, periodo, serie:series(nome)")
          .eq("escola_id", escolaId)
          .order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma turma cadastrada ainda." }

        const porPeriodo = {
          manha: data.filter((t) => t.periodo === "manha"),
          tarde: data.filter((t) => t.periodo === "tarde"),
          integral: data.filter((t) => t.periodo === "integral"),
        }

        let msg = `**🏫 Turmas (${data.length}):**\n\n`
        if (porPeriodo.manha.length) {
          msg += `🌅 **Manhã (${porPeriodo.manha.length}):** ${porPeriodo.manha.map((t) => t.nome).join(", ")}\n`
        }
        if (porPeriodo.tarde.length) {
          msg += `🌆 **Tarde (${porPeriodo.tarde.length}):** ${porPeriodo.tarde.map((t) => t.nome).join(", ")}\n`
        }
        if (porPeriodo.integral.length) {
          msg += `📚 **Integral (${porPeriodo.integral.length}):** ${porPeriodo.integral.map((t) => t.nome).join(", ")}\n`
        }

        return { ok: true, mensagem: msg }
      }

      case "listar_materias": {
        const { data } = await supabase
          .from("materias")
          .select("nome, cor")
          .eq("escola_id", escolaId)
          .order("nome")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma matéria cadastrada ainda." }
        return {
          ok: true,
          mensagem: `**📚 Matérias (${data.length}):**\n\n${data.map((m) => `• ${m.nome}`).join("\n")}`,
        }
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

        return {
          ok: true,
          mensagem: `**📊 Status Geral da Escola**\n\n🏫 Turmas: ${tRes.count || 0}\n👥 Professores: ${total} (${presentes} ✅ presentes, ${ausentes} ❌ ausentes)\n📚 Matérias: ${mRes.count || 0}\n🎓 Séries: ${sRes.count || 0}\n📋 Faltas hoje: ${fRes.count || 0}\n📅 Aulas na grade: ${gRes.count || 0}`,
        }
      }

      case "editar_professor": {
        const busca = params.busca || params.nome
        const { data: profs } = await supabase
          .from("professores")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${busca}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${busca}" não encontrado.` }
        const prof = profs[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {}
        if (params.nome && params.nome !== busca) updates.nome = params.nome
        if (params.email) updates.email = params.email
        if (params.telefone) updates.telefone = params.telefone
        if (params.especialidades) updates.especialidades = params.especialidades
        if (params.carga_horaria) updates.carga_horaria = params.carga_horaria
        if (params.status) updates.status = params.status
        if (Object.keys(updates).length === 0) {
          return {
            ok: false,
            mensagem: "Nenhum campo para atualizar. Ex: 'mude o email do João para joao@escola.com'",
          }
        }
        const { error } = await supabase.from("professores").update(updates).eq("id", prof.id)
        if (error) return { ok: false, mensagem: `Erro ao editar: ${error.message}` }
        const campos = Object.entries(updates)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
        return { ok: true, mensagem: `✅ Professor **"${prof.nome}"** atualizado!\n${campos}` }
      }

      case "editar_turma": {
        const busca = params.busca || params.nome
        const { data: turmas } = await supabase
          .from("turmas")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${busca}%`)
        if (!turmas?.length) return { ok: false, mensagem: `Turma "${busca}" não encontrada.` }
        const turma = turmas[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {}
        if (params.nome && params.nome !== busca) updates.nome = params.nome
        if (params.periodo) updates.periodo = params.periodo
        if (params.serie_id) updates.serie_id = params.serie_id
        if (Object.keys(updates).length === 0)
          return { ok: false, mensagem: "Nenhum campo para atualizar." }
        const { error } = await supabase.from("turmas").update(updates).eq("id", turma.id)
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `✅ Turma **"${turma.nome}"** atualizada!` }
      }

      case "editar_materia": {
        const busca = params.busca || params.nome
        const { data: materias } = await supabase
          .from("materias")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${busca}%`)
        if (!materias?.length) return { ok: false, mensagem: `Matéria "${busca}" não encontrada.` }
        const materia = materias[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {}
        if (params.nome && params.nome !== busca) updates.nome = params.nome
        if (params.cor) updates.cor = params.cor
        if (Object.keys(updates).length === 0)
          return { ok: false, mensagem: "Nenhum campo para atualizar." }
        const { error } = await supabase.from("materias").update(updates).eq("id", materia.id)
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `✅ Matéria **"${materia.nome}"** atualizada!` }
      }

      case "deletar_professor": {
        const cmdTexto = String(params._comando || "")
        const excluirTodos =
          params.todos === true ||
          /\b(?:todos|todas)\b/i.test(cmdTexto) &&
            /\b(?:exclu|delet|remov|apag)/i.test(cmdTexto)

        if (excluirTodos) {
          const { data: todos, error: errList } = await supabase
            .from("professores")
            .select("id, nome")
            .eq("escola_id", escolaId)
          if (errList) return { ok: false, mensagem: `Erro ao listar: ${errList.message}` }
          if (!todos?.length) {
            return { ok: true, mensagem: "Não há professores cadastrados para excluir." }
          }
          const { error } = await supabase
            .from("professores")
            .delete()
            .eq("escola_id", escolaId)
          if (error) return { ok: false, mensagem: `Erro ao excluir: ${error.message}` }
          return {
            ok: true,
            mensagem: `🗑️ **${todos.length} professor(es)** removido(s) do sistema.`,
          }
        }

        const nome = (params.nome || params.busca || "").trim()
        if (!nome) {
          const { data: cadastrados } = await supabase
            .from("professores")
            .select("nome")
            .eq("escola_id", escolaId)
            .order("nome")
          if (!cadastrados?.length) {
            return { ok: true, mensagem: "Não há professores cadastrados no banco." }
          }
          return {
            ok: false,
            mensagem: `Informe o nome do professor. Cadastrados: ${cadastrados.map((p) => p.nome).join(", ")}`,
          }
        }

        const { data: profs, error: errBusca } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (errBusca) return { ok: false, mensagem: `Erro na busca: ${errBusca.message}` }
        if (!profs?.length) {
          const { data: todos } = await supabase
            .from("professores")
            .select("nome")
            .eq("escola_id", escolaId)
          const lista = todos?.map((p) => p.nome).join(", ") || "nenhum"
          return {
            ok: false,
            mensagem: `Professor "${nome}" não encontrado. Cadastrados: ${lista}`,
          }
        }

        const alvo = profs[0]
        const { error } = await supabase.from("professores").delete().eq("id", alvo.id)
        if (error) return { ok: false, mensagem: `Erro ao excluir: ${error.message}` }
        return { ok: true, mensagem: `🗑️ Professor **"${alvo.nome}"** removido do sistema.` }
      }

      case "deletar_turma": {
        const nome = params.nome || params.busca
        const { data: turmas } = await supabase
          .from("turmas")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!turmas?.length) return { ok: false, mensagem: `Turma "${nome}" não encontrada.` }
        await supabase.from("turmas").delete().eq("id", turmas[0].id)
        return { ok: true, mensagem: `🗑️ Turma **"${turmas[0].nome}"** removida.` }
      }

      case "deletar_materia": {
        const nome = params.nome || params.busca
        const { data: materias } = await supabase
          .from("materias")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!materias?.length) return { ok: false, mensagem: `Matéria "${nome}" não encontrada.` }
        await supabase.from("materias").delete().eq("id", materias[0].id)
        return { ok: true, mensagem: `🗑️ Matéria **"${materias[0].nome}"** removida.` }
      }

      case "detalhes_professor": {
        const nome = params.nome || params.busca
        const { data: profs } = await supabase
          .from("professores")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const p = profs[0]
        const statusEmoji =
          p.status === "presente" ? "🟢" :
          p.status === "ausente" ? "🔴" :
          p.status === "ferias" ? "🏖️" : "🟡"
        return {
          ok: true,
          mensagem: `**👤 ${p.nome}**\n\n${statusEmoji} Status: ${p.status}\n📧 Email: ${p.email || "não informado"}\n📱 Telefone: ${p.telefone || "não informado"}\n🎯 Especialidades: ${(p.especialidades || []).join(", ") || "nenhuma"}\n⏰ Carga Horária: ${p.carga_horaria}h`,
        }
      }

      // ========== PERIODOS ==========
      case "criar_periodo": {
        const tipo = params.tipo || "aula"
        const { data: existing } = await supabase
          .from("periodos")
          .select("ordem")
          .eq("escola_id", escolaId)
          .order("ordem", { ascending: false })
          .limit(1)
        const ordem = params.ordem || (existing?.[0]?.ordem ?? 0) + 1
        const hora_inicio = params.hora_inicio || params.inicio || "08:00"
        const hora_fim = params.hora_fim || params.fim || "09:00"
        const { error } = await supabase.from("periodos").insert({
          escola_id: escolaId,
          nome: params.nome,
          tipo,
          ordem,
          hora_inicio,
          hora_fim,
        })
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `✨ Período **"${params.nome}"** criado! (${hora_inicio} às ${hora_fim})` }
      }

      case "listar_periodos": {
        const { data } = await supabase
          .from("periodos")
          .select("*")
          .eq("escola_id", escolaId)
          .order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhum período cadastrado." }
        const lista = data
          .map((p) => `• **${p.nome}** (${p.tipo}) — ${p.hora_inicio} às ${p.hora_fim}`)
          .join("\n")
        return { ok: true, mensagem: `**⏰ Períodos (${data.length}):**\n\n${lista}` }
      }

      case "editar_periodo": {
        const busca = params.busca || params.nome
        const { data: periodos } = await supabase
          .from("periodos")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${busca}%`)
        if (!periodos?.length) return { ok: false, mensagem: `Período "${busca}" não encontrado.` }
        const periodo = periodos[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {}
        if (params.nome && params.nome !== busca) updates.nome = params.nome
        if (params.tipo) updates.tipo = params.tipo
        if (params.hora_inicio) updates.hora_inicio = params.hora_inicio
        if (params.hora_fim) updates.hora_fim = params.hora_fim
        if (params.ordem) updates.ordem = params.ordem
        if (Object.keys(updates).length === 0)
          return { ok: false, mensagem: "Nenhum campo para atualizar." }
        const { error } = await supabase.from("periodos").update(updates).eq("id", periodo.id)
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `✅ Período **"${periodo.nome}"** atualizado!` }
      }

      case "deletar_periodo": {
        const nome = params.nome || params.busca
        const { data: periodos } = await supabase
          .from("periodos")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!periodos?.length) return { ok: false, mensagem: `Período "${nome}" não encontrado.` }
        await supabase.from("periodos").delete().eq("id", periodos[0].id)
        return { ok: true, mensagem: `🗑️ Período **"${periodos[0].nome}"** removido.` }
      }

      // ========== SERIES ==========
      case "criar_serie": {
        const nomesSerie = resolverListaNomesCadastro(
          params,
          params._comando as string | undefined,
          "serie"
        )
        if (!nomesSerie.length) {
          return { ok: false, mensagem: "Informe o nome da(s) série(s)." }
        }

        const { data: existing } = await supabase
          .from("series")
          .select("ordem")
          .eq("escola_id", escolaId)
          .order("ordem", { ascending: false })
          .limit(1)
        let ordemBase = (existing?.[0]?.ordem ?? 0) as number
        const criadas: string[] = []
        const erros: string[] = []

        for (const nome of nomesSerie) {
          ordemBase += 1
          const { error } = await supabase
            .from("series")
            .insert({ escola_id: escolaId, nome, ordem: params.ordem || ordemBase })
          if (error) erros.push(`• ${nome}: ${error.message}`)
          else criadas.push(nome)
        }

        if (!criadas.length) {
          return { ok: false, mensagem: `Erro ao criar série(s):\n${erros.join("\n")}` }
        }

        let msg =
          criadas.length === 1
            ? `✨ Série **"${criadas[0]}"** criada!`
            : `✨ **${criadas.length} séries** criadas:\n${criadas.map((n) => `• ${n}`).join("\n")}`
        if (erros.length) msg += `\n\n⚠️ Falhas:\n${erros.join("\n")}`
        return { ok: true, mensagem: msg }
      }

      case "editar_serie": {
        const busca = params.busca || params.nome
        const { data: series } = await supabase
          .from("series")
          .select("*")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${busca}%`)
        if (!series?.length) return { ok: false, mensagem: `Série "${busca}" não encontrada.` }
        const serie = series[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: any = {}
        if (params.nome && params.nome !== busca) updates.nome = params.nome
        if (params.ordem) updates.ordem = params.ordem
        if (!Object.keys(updates).length)
          return { ok: false, mensagem: "Nenhum campo para atualizar." }
        await supabase.from("series").update(updates).eq("id", serie.id)
        return { ok: true, mensagem: `✅ Série **"${serie.nome}"** atualizada!` }
      }

      case "deletar_serie": {
        const nome = params.nome || params.busca
        const { data: series } = await supabase
          .from("series")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!series?.length) return { ok: false, mensagem: `Série "${nome}" não encontrada.` }
        await supabase.from("series").delete().eq("id", series[0].id)
        return { ok: true, mensagem: `🗑️ Série **"${series[0].nome}"** removida.` }
      }

      case "listar_series": {
        const { data } = await supabase
          .from("series")
          .select("*")
          .eq("escola_id", escolaId)
          .order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma série cadastrada." }
        return {
          ok: true,
          mensagem: `**🎓 Séries:**\n\n${data.map((s) => `• ${s.nome} (ordem ${s.ordem})`).join("\n")}`,
        }
      }

      // ========== PROFESSOR EXTRAS ==========
      case "alterar_status_professor": {
        const nome = params.nome || params.busca
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const status = (params.status || "presente")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
        const statusMap: Record<string, string> = {
          presente: "presente",
          ausente: "ausente",
          ferias: "ferias",
          licenca: "licenca",
          atestado: "atestado",
        }
        const finalStatus = statusMap[status] || "presente"
        await supabase.from("professores").update({ status: finalStatus }).eq("id", profs[0].id)
        const emoji =
          finalStatus === "presente" ? "🟢" :
          finalStatus === "ausente" ? "🔴" :
          finalStatus === "ferias" ? "🏖️" : "🟡"
        return {
          ok: true,
          mensagem: `${emoji} Status de **"${profs[0].nome}"** alterado para **${finalStatus}**!`,
        }
      }

      case "listar_disponiveis": {
        const { data } = await supabase
          .from("professores")
          .select("nome, especialidades, carga_horaria")
          .eq("escola_id", escolaId)
          .eq("status", "presente")
          .order("nome")
        if (!data?.length)
          return { ok: true, mensagem: "⚠️ Nenhum professor disponível no momento." }
        const lista = data
          .map((p) => `🟢 **${p.nome}** — ${(p.especialidades || []).join(", ") || "geral"} (${p.carga_horaria}h)`)
          .join("\n")
        return { ok: true, mensagem: `**✅ Disponíveis (${data.length}):**\n\n${lista}` }
      }

      case "professores_por_especialidade": {
        const esp = (params.especialidade || params.nome || "").toLowerCase()
        const { data } = await supabase
          .from("professores")
          .select("nome, especialidades, status")
          .eq("escola_id", escolaId)
        const filtrados = esp
          ? data?.filter((p) =>
              p.especialidades?.some((e: string) => e.toLowerCase().includes(esp))
            )
          : data
        if (!filtrados?.length)
          return {
            ok: true,
            mensagem: esp
              ? `Nenhum professor com especialidade "${esp}".`
              : "Nenhum professor cadastrado.",
          }
        const lista = filtrados
          .map((p) => {
            const statusEmoji =
              p.status === "presente" ? "🟢" : p.status === "ausente" ? "🔴" : "🟡"
            return `${statusEmoji} **${p.nome}** [${(p.especialidades || []).join(", ")}]`
          })
          .join("\n")
        return {
          ok: true,
          mensagem: `**${esp ? `Professores de ${esp}` : "Todos os Professores"} (${filtrados.length}):**\n\n${lista}`,
        }
      }

      case "turmas_sem_professor": {
        const { data: grade } = await supabase
          .from("grade_horarios")
          .select("turma_id")
          .eq("escola_id", escolaId)
        const { data: turmas } = await supabase
          .from("turmas")
          .select("id, nome")
          .eq("escola_id", escolaId)
        const comAula = new Set(grade?.map((g) => g.turma_id) || [])
        const sem = turmas?.filter((t) => !comAula.has(t.id)) || []
        if (!sem.length) return { ok: true, mensagem: "✅ Todas as turmas têm aulas na grade!" }
        return {
          ok: true,
          mensagem: `**⚠️ Turmas sem aula na grade (${sem.length}):**\n\n${sem.map((t) => `• ${t.nome}`).join("\n")}\n\nDiga _"gere a grade horária"_ para criar automaticamente!`,
        }
      }

      // ========== FALTAS ==========
      case "listar_faltas": {
        const { data } = await supabase
          .from("faltas")
          .select("*, professor:professores(nome)")
          .eq("escola_id", escolaId)
          .order("created_at", { ascending: false })
          .limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma falta registrada." }
        const lista = data
          .map(
            (f) =>
              `• **${nomeRelacao(f.professor)}** — ${f.data} — ${f.motivo} (${f.status === "justificada" ? "✅ justificada" : "❌ injustificada"})`
          )
          .join("\n")
        return { ok: true, mensagem: `**📋 Últimas Faltas (${data.length}):**\n\n${lista}` }
      }

      case "deletar_falta": {
        const nome = params.professor_nome || params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
          .limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const { data: faltas } = await supabase
          .from("faltas")
          .select("id")
          .eq("escola_id", escolaId)
          .eq("professor_id", profs[0].id)
          .order("created_at", { ascending: false })
          .limit(1)
        if (!faltas?.length)
          return { ok: false, mensagem: `Nenhuma falta encontrada para "${profs[0].nome}".` }
        await supabase.from("faltas").delete().eq("id", faltas[0].id)
        return { ok: true, mensagem: `🗑️ Falta de **${profs[0].nome}** removida!` }
      }

      case "justificar_falta": {
        const nome = params.professor_nome || params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
          .limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const { data: faltas } = await supabase
          .from("faltas")
          .select("id")
          .eq("escola_id", escolaId)
          .eq("professor_id", profs[0].id)
          .eq("status", "injustificada")
          .limit(1)
        if (!faltas?.length)
          return {
            ok: false,
            mensagem: `Nenhuma falta injustificada para "${profs[0].nome}".`,
          }
        await supabase
          .from("faltas")
          .update({ status: "justificada", motivo: params.motivo || "Justificado via IA" })
          .eq("id", faltas[0].id)
        return { ok: true, mensagem: `✅ Falta de **${profs[0].nome}** justificada!` }
      }

      case "faltas_do_professor": {
        const nome = params.nome || params.busca || params.professor_nome
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
          .limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }
        const { data: faltas } = await supabase
          .from("faltas")
          .select("data, motivo, status")
          .eq("escola_id", escolaId)
          .eq("professor_id", profs[0].id)
          .order("data", { ascending: false })
        if (!faltas?.length)
          return { ok: true, mensagem: `✅ Nenhuma falta registrada para **"${profs[0].nome}"**.` }
        const lista = faltas
          .map(
            (f) =>
              `• ${f.data} — ${f.motivo} (${f.status === "justificada" ? "✅" : "❌"} ${f.status})`
          )
          .join("\n")
        return {
          ok: true,
          mensagem: `**📋 Faltas de ${profs[0].nome} (${faltas.length}):**\n\n${lista}`,
        }
      }

      case "professor_mais_faltas": {
        const { data } = await supabase
          .from("faltas")
          .select("professor_id, professor:professores(nome)")
          .eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma falta registrada." }
        const contagem: Record<string, { nome: string; count: number }> = {}
        for (const f of data) {
          const key = f.professor_id
          const prof = f.professor as { nome?: string } | { nome?: string }[] | null
          const nomeProf = Array.isArray(prof) ? prof[0]?.nome : prof?.nome
          if (!contagem[key]) contagem[key] = { nome: nomeProf || "?", count: 0 }
          contagem[key].count++
        }
        const ranking = Object.values(contagem)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
        const lista = ranking
          .map(
            (r, i) =>
              `${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  "} **${r.nome}** — ${r.count} falta(s)`
          )
          .join("\n")
        return { ok: true, mensagem: `**📊 Ranking de Faltas:**\n\n${lista}` }
      }

      // ========== SUBSTITUICOES ==========
      case "listar_substituicoes": {
        const { data } = await supabase
          .from("substituicoes")
          .select(
            "*, professor_original:professores!professor_original_id(nome), professor_substituto:professores!professor_substituto_id(nome)"
          )
          .eq("escola_id", escolaId)
          .order("created_at", { ascending: false })
          .limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição registrada." }
        const lista = data
          .map((s) => {
            const statusEmoji =
              s.status === "confirmada" ? "✅" : s.status === "pendente" ? "⏳" : "❌"
            return `${statusEmoji} **${nomeRelacao(s.professor_original)}** → ${nomeRelacao(s.professor_substituto)} (${s.data}) — ${s.status}`
          })
          .join("\n")
        return { ok: true, mensagem: `**🔄 Substituições:**\n\n${lista}` }
      }

      case "sugerir_substituto": {
        const nome = params.professor_nome || params.nome || params.busca
        const { data: profs } = await supabase
          .from("professores")
          .select("id, nome, especialidades, carga_horaria, status")
          .eq("escola_id", escolaId)
          .eq("status", "presente")
        if (!profs?.length)
          return { ok: true, mensagem: "⚠️ Nenhum professor disponível para substituição." }
        if (!nome)
          return {
            ok: true,
            mensagem: `**✅ Disponíveis para substituir:**\n\n${profs.map((p) => `• **${p.nome}** [${(p.especialidades || []).join(", ") || "geral"}]`).join("\n")}`,
          }
        const { data: ausente } = await supabase
          .from("professores")
          .select("id, nome, especialidades, carga_horaria, status")
          .eq("escola_id", escolaId)
          .ilike("nome", `%${nome}%`)
          .limit(1)
        if (!ausente?.length)
          return { ok: false, mensagem: `Professor "${nome}" não encontrado.` }

        const candidatos = profs.filter((p) => p.id !== ausente[0].id)
        if (!candidatos.length)
          return { ok: false, mensagem: "Nenhum substituto disponível." }

        const apiRes = await fetch("/api/ia/sugerir-substituto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            professorAusente: ausente[0],
            professoresDisponiveis: candidatos,
            materia: params.materia || "",
            horario: params.horario || null,
          }),
        })
        const sugestao = await apiRes.json()
        if (!apiRes.ok) {
          return { ok: false, mensagem: sugestao.error || formatIaError("Erro ao sugerir substituto") }
        }

        const confianca =
          sugestao.confianca != null ? `\nConfiança da IA: **${sugestao.confianca}%**` : ""

        return {
          ok: true,
          mensagem: `💡 **Sugestão de Substituto (IA):**\n\n✨ **${sugestao.substituto || "—"}** para substituir **${ausente[0].nome}**\n\n${sugestao.justificativa || ""}${confianca}\n\n_Diga "confirme a substituição" para confirmar._`,
        }
      }

      case "confirmar_substituicao": {
        const { data } = await supabase
          .from("substituicoes")
          .select(
            "id, professor_original:professores!professor_original_id(nome), professor_substituto:professores!professor_substituto_id(nome)"
          )
          .eq("escola_id", escolaId)
          .eq("status", "pendente")
          .limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição pendente." }
        await supabase
          .from("substituicoes")
          .update({ status: "confirmada" })
          .eq("id", data[0].id)
        return {
          ok: true,
          mensagem: `✅ Substituição confirmada!\n**${nomeRelacao(data[0].professor_substituto)}** → substitui → **${nomeRelacao(data[0].professor_original)}**`,
        }
      }

      case "recusar_substituicao": {
        const { data } = await supabase
          .from("substituicoes")
          .select("id")
          .eq("escola_id", escolaId)
          .eq("status", "pendente")
          .limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição pendente." }
        await supabase
          .from("substituicoes")
          .update({ status: "recusada" })
          .eq("id", data[0].id)
        return { ok: true, mensagem: "❌ Substituição recusada." }
      }

      case "cancelar_substituicao": {
        const { data } = await supabase
          .from("substituicoes")
          .select("id")
          .eq("escola_id", escolaId)
          .neq("status", "recusada")
          .limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição ativa." }
        await supabase
          .from("substituicoes")
          .update({ status: "recusada" })
          .eq("id", data[0].id)
        return { ok: true, mensagem: "🗑️ Substituição cancelada!" }
      }

      // ========== PLANEJAMENTO ==========
      case "criar_planejamento": {
        const desc = String(params.descricao || params.conteudo || params.nome || "")
        if (!desc) return { ok: false, mensagem: "Informe o conteúdo do planejamento." }

        async function resolverId(
          tabela: "turmas" | "materias" | "professores",
          idParam?: unknown,
          nomeParam?: unknown
        ) {
          if (idParam) return String(idParam)
          const nome = nomeParam ? String(nomeParam) : ""
          if (!nome) return null
          const { data } = await supabase
            .from(tabela)
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("nome", `%${nome}%`)
            .limit(1)
          return data?.[0]?.id || null
        }

        const turmaId = await resolverId(
          "turmas",
          params.turma_id,
          params.turma_nome || params.turma
        )
        const materiaId = await resolverId(
          "materias",
          params.materia_id,
          params.materia_nome || params.materia
        )
        const professorId = await resolverId(
          "professores",
          params.professor_id,
          params.professor_nome || params.professor
        )

        const [tFallback, mFallback, pFallback] = await Promise.all([
          turmaId
            ? Promise.resolve({ data: [{ id: turmaId }] })
            : supabase.from("turmas").select("id").eq("escola_id", escolaId).limit(1),
          materiaId
            ? Promise.resolve({ data: [{ id: materiaId }] })
            : supabase.from("materias").select("id").eq("escola_id", escolaId).limit(1),
          professorId
            ? Promise.resolve({ data: [{ id: professorId }] })
            : supabase.from("professores").select("id").eq("escola_id", escolaId).limit(1),
        ])

        if (
          !tFallback.data?.length ||
          !mFallback.data?.length ||
          !pFallback.data?.length
        ) {
          return { ok: false, mensagem: "Crie turmas, matérias e professores antes de criar planejamentos." }
        }

        const hoje = new Date()
        const dia = hoje.getDay()
        const diff = hoje.getDate() - dia + (dia === 0 ? -6 : 1)
        const segunda = new Date(hoje.setDate(diff))

        const { error } = await supabase.from("planejamento_semanal").insert({
          escola_id: escolaId,
          turma_id: tFallback.data[0].id,
          materia_id: mFallback.data[0].id,
          professor_id: pFallback.data[0].id,
          semana_inicio: segunda.toISOString().split("T")[0],
          conteudo: desc,
          objetivos: String(params.objetivos || desc),
        })
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return {
          ok: true,
          mensagem: `✨ Planejamento criado!\n_"${desc.substring(0, 60)}${desc.length > 60 ? "..." : ""}"_`,
        }
      }

      case "editar_planejamento": {
        const { data } = await supabase
          .from("planejamento_semanal")
          .select("id, conteudo")
          .eq("escola_id", escolaId)
          .order("created_at", { ascending: false })
          .limit(1)
        if (!data?.length)
          return { ok: false, mensagem: "Nenhum planejamento encontrado." }
        await supabase
          .from("planejamento_semanal")
          .update({
            conteudo: params.conteudo || params.descricao || params.nome,
            objetivos: params.objetivos || params.conteudo || params.nome,
          })
          .eq("id", data[0].id)
        return { ok: true, mensagem: "✅ Planejamento atualizado!" }
      }

      case "deletar_planejamento": {
        const { data } = await supabase
          .from("planejamento_semanal")
          .select("id")
          .eq("escola_id", escolaId)
          .limit(1)
        if (!data?.length)
          return { ok: false, mensagem: "Nenhum planejamento para deletar." }
        await supabase.from("planejamento_semanal").delete().eq("id", data[0].id)
        return { ok: true, mensagem: "🗑️ Planejamento removido!" }
      }

      case "listar_planejamentos": {
        const { data } = await supabase
          .from("planejamento_semanal")
          .select(
            "*, turma:turmas(nome), materia:materias(nome), professor:professores(nome)"
          )
          .eq("escola_id", escolaId)
          .order("created_at", { ascending: false })
          .limit(20)
        if (!data?.length)
          return { ok: true, mensagem: "Nenhum planejamento cadastrado ainda." }
        const lista = data
          .map(
            (p) =>
              `• **${nomeRelacao(p.turma)}** | ${nomeRelacao(p.materia)} — _${p.conteudo?.substring(0, 40)}${(p.conteudo?.length || 0) > 40 ? "..." : ""}_`
          )
          .join("\n")
        return { ok: true, mensagem: `**📋 Planejamentos (${data.length}):**\n\n${lista}` }
      }

      // ========== GRADE HORÁRIA & SETUP AUTÔNOMO ==========
      case "gerar_grade":
      case "otimizar_grade":
      case "montar_escola_completa":
      case "gerar_tudo": {
        try {
          const montarCompleto =
            acao === "montar_escola_completa" || acao === "gerar_tudo"
          const partes: string[] = []

          const setup = await garantirDadosEscola(supabase, escolaId, {
            completo: montarCompleto,
            tipo: tipoEscola,
          })
          if (setup.mensagem) partes.push(setup.mensagem)

          const deveGerarGrade =
            acao === "gerar_grade" ||
            acao === "otimizar_grade" ||
            (montarCompleto && params.gerar_grade !== false)

          if (deveGerarGrade) {
            const [tRes, mRes, pRes, perRes, gRes] = await Promise.all([
              supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId),
              supabase.from("materias").select("id, nome").eq("escola_id", escolaId),
              supabase
                .from("professores")
                .select("id, nome, especialidades, carga_horaria")
                .eq("escola_id", escolaId)
                .eq("status", "presente"),
              supabase
                .from("periodos")
                .select("*")
                .eq("escola_id", escolaId)
                .order("ordem"),
              supabase
                .from("grade_horarios")
                .select("*, materia:materias(nome), professor:professores(nome)")
                .eq("escola_id", escolaId),
            ])

            const periodosAula = (perRes.data || []).filter((p) => p.tipo === "aula")
            if (
              !tRes.data?.length ||
              !mRes.data?.length ||
              !pRes.data?.length ||
              !periodosAula.length
            ) {
              partes.push(
                "❌ Ainda faltam dados para a grade após o setup automático. Tente: **gere tudo salas professores e grade**."
              )
              return { ok: false, mensagem: partes.join("\n\n") }
            }

            const apiRes = await fetch("/api/ia/gerar-grade", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                turmas: tRes.data,
                materias: mRes.data,
                professores: pRes.data,
                periodos: perRes.data,
                gradeAtual: gRes.data || [],
              }),
            })

            let payload = await apiRes.json()
            if (!apiRes.ok) {
              partes.push(payload.error || formatIaError(`Erro ${apiRes.status} ao gerar grade`))
              return { ok: false, mensagem: partes.join("\n\n") }
            }

            const resultado = await persistGradeHorarios(
              supabase,
              escolaId,
              payload,
              tRes.data,
              mRes.data,
              pRes.data,
              perRes.data || []
            )

            if (resultado.ok) {
              await supabase.from("eventos_tempo_real").insert({
                escola_id: escolaId,
                tipo: "alerta",
                mensagem: `Grade horária gerada pela IA com ${resultado.count} aulas!`,
              })
              partes.push(`✅ ${resultado.mensagem}`)
            } else {
              partes.push(`❌ ${resultado.mensagem}`)
            }
          }

          const deveGerarRecreio =
            escolaTemRecreioIntercalado(tipoEscola) &&
            montarCompleto &&
            params.gerar_recreio !== false

          if (deveGerarRecreio) {
            const { data: turmasData } = await supabase
              .from("turmas")
              .select("id, nome, periodo")
              .eq("escola_id", escolaId)

            if (turmasData?.length) {
              const apiRec = await fetch("/api/ia/gerar-recreio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  turmas: turmasData,
                  espacosDisponiveis: 2,
                  duracao: 20,
                }),
              })
              const payloadRec = await apiRec.json()
              if (apiRec.ok) {
                const rec = await persistRecreioIntercalado(
                  supabase,
                  escolaId,
                  payloadRec,
                  turmasData
                )
                partes.push(rec.ok ? `✅ ${rec.mensagem}` : `❌ ${rec.mensagem}`)
              } else {
                partes.push(payloadRec.error || "Erro ao organizar recreio")
              }
            }
          }

          const okFinal = partes.some((p) => p.startsWith("✅"))
          return {
            ok: okFinal || montarCompleto,
            mensagem: partes.join("\n\n") || "Comando concluído.",
          }
        } catch (e) {
          return {
            ok: false,
            mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}`,
          }
        }
      }

      case "limpar_grade": {
        const { count } = await supabase
          .from("grade_horarios")
          .select("id", { count: "exact", head: true })
          .eq("escola_id", escolaId)
        await supabase.from("grade_horarios").delete().eq("escola_id", escolaId)
        return {
          ok: true,
          mensagem: `🗑️ Grade horária limpa! (${count || 0} aulas removidas)`,
        }
      }

      case "listar_grade_turma": {
        const busca = params.nome || params.busca || params.turma_nome
        const query = busca
          ? supabase
              .from("turmas")
              .select("id, nome")
              .eq("escola_id", escolaId)
              .ilike("nome", `%${busca}%`)
              .limit(1)
          : supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).limit(1)
        const { data: turmas } = await query
        if (!turmas?.length) return { ok: false, mensagem: "Nenhuma turma encontrada." }

        const { data } = await supabase
          .from("grade_horarios")
          .select(
            "dia_semana, materia:materias(nome), professor:professores(nome), periodo:periodos(nome, hora_inicio)"
          )
          .eq("escola_id", escolaId)
          .eq("turma_id", turmas[0].id)
          .order("dia_semana")

        if (!data?.length)
          return {
            ok: true,
            mensagem: `Grade vazia para **"${turmas[0].nome}"**.\n\nDiga _"gere a grade horária"_ para criar!`,
          }

        const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]
        const porDia: Record<number, string[]> = {}
        for (const a of data) {
          if (!porDia[a.dia_semana]) porDia[a.dia_semana] = []
          const periodo = a.periodo as { hora_inicio?: string } | { hora_inicio?: string }[] | null
          const hora = Array.isArray(periodo) ? periodo[0]?.hora_inicio : periodo?.hora_inicio
          porDia[a.dia_semana].push(
            `  • ${nomeRelacao(a.materia)} (${nomeRelacao(a.professor)}) ${hora ? `— ${hora}` : ""}`
          )
        }

        let msg = `**📅 Grade — ${turmas[0].nome}:**\n\n`
        for (let i = 0; i < 5; i++) {
          if (porDia[i]?.length) {
            msg += `**${dias[i]}:**\n${porDia[i].join("\n")}\n`
          }
        }

        return { ok: true, mensagem: msg }
      }

      case "verificar_conflitos": {
        const { validarGrade } = await import("@/lib/grade-gerador")
        const [gRes, tRes, pRes, perRes] = await Promise.all([
          supabase.from("grade_horarios").select("turma_id, materia_id, professor_id, dia_semana, periodo_id").eq("escola_id", escolaId),
          supabase.from("turmas").select("id, nome").eq("escola_id", escolaId),
          supabase.from("professores").select("id, nome, especialidades").eq("escola_id", escolaId),
          supabase.from("periodos").select("id, nome, tipo, ordem").eq("escola_id", escolaId).order("ordem"),
        ])
        if (!gRes.data?.length)
          return { ok: true, mensagem: "Grade vazia, nenhum conflito possível." }

        const periodosAula = (perRes.data || []).filter((p) => p.tipo === "aula")
        const v = validarGrade(gRes.data, periodosAula, tRes.data || [], pRes.data || [])
        if (v.ok)
          return {
            ok: true,
            mensagem:
              "✅ **Grade válida!** Todas as salas, sem professor em dois lugares ao mesmo tempo e no máximo 2 aulas seguidas.",
          }

        const lista = [...v.conflitos, ...v.sequenciasLongas].map((m) => `⚠️ ${m}`).join("\n")
        return {
          ok: false,
          mensagem: `**⚠️ Problemas na grade (${v.conflitos.length + v.sequenciasLongas.length}):**\n\n${lista}\n\nDiga _"gere a grade horária"_ para recriar todas as salas.`,
        }
      }

      case "adicionar_aula": {
        const tNome = params.turma_nome || params.turma
        const mNome = params.materia_nome || params.materia
        const pNome = params.professor_nome || params.professor
        const dia = params.dia_semana ?? 0

        const [tRes, mRes, pRes, perRes] = await Promise.all([
          supabase
            .from("turmas")
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("nome", `%${tNome || ""}%`)
            .limit(1),
          supabase
            .from("materias")
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("nome", `%${mNome || ""}%`)
            .limit(1),
          supabase
            .from("professores")
            .select("id")
            .eq("escola_id", escolaId)
            .ilike("nome", `%${pNome || ""}%`)
            .limit(1),
          supabase
            .from("periodos")
            .select("id")
            .eq("escola_id", escolaId)
            .order("ordem")
            .limit(1),
        ])

        if (
          !tRes.data?.length ||
          !mRes.data?.length ||
          !pRes.data?.length ||
          !perRes.data?.length
        ) {
          return {
            ok: false,
            mensagem: "Turma, matéria, professor ou período não encontrado.",
          }
        }

        const profId = pRes.data[0].id
        const turmaId = tRes.data[0].id
        const periodoId = perRes.data[0].id

        const { data: profOcupado } = await supabase
          .from("grade_horarios")
          .select("id, turma:turmas(nome)")
          .eq("escola_id", escolaId)
          .eq("professor_id", profId)
          .eq("dia_semana", dia)
          .eq("periodo_id", periodoId)
          .maybeSingle()

        if (profOcupado) {
          const sala = nomeRelacao(profOcupado.turma)
          return {
            ok: false,
            mensagem: `❌ **${pNome || "Professor"}** já leciona em **${sala}** neste horário. Um professor só pode estar em **uma turma por vez**.`,
          }
        }

        const { data: turmaOcupada } = await supabase
          .from("grade_horarios")
          .select("id")
          .eq("turma_id", turmaId)
          .eq("dia_semana", dia)
          .eq("periodo_id", periodoId)
          .maybeSingle()

        if (turmaOcupada) {
          return {
            ok: false,
            mensagem: `❌ Esta turma já tem aula neste horário. Remova a aula atual ou escolha outro período.`,
          }
        }

        const { error } = await supabase.from("grade_horarios").insert({
          escola_id: escolaId,
          turma_id: turmaId,
          materia_id: mRes.data[0].id,
          professor_id: profId,
          dia_semana: dia,
          periodo_id: periodoId,
        })

        if (error) {
          const msg =
            error.code === "23505"
              ? "Conflito: professor já está em outra turma neste mesmo horário."
              : error.message
          return { ok: false, mensagem: `Erro: ${msg}` }
        }
        const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]
        return {
          ok: true,
          mensagem: `✅ Aula adicionada!\n📚 ${mNome || "?"} — ${pNome || "?"}\n📅 ${dias[dia] || `Dia ${dia}`}`,
        }
      }

      case "remover_aula": {
        const { data: grade } = await supabase
          .from("grade_horarios")
          .select("id, materia:materias(nome)")
          .eq("escola_id", escolaId)
          .limit(1)
        if (!grade?.length) return { ok: true, mensagem: "Grade vazia." }
        await supabase.from("grade_horarios").delete().eq("id", grade[0].id)
        return { ok: true, mensagem: `🗑️ Aula de **${nomeRelacao(grade[0].materia)}** removida!` }
      }

      // ========== RECREIO ==========
      case "gerar_recreio": {
        if (!escolaTemRecreioIntercalado(tipoEscola)) {
          return {
            ok: false,
            mensagem: mensagemRecursoIndisponivel("gerar_recreio", tipoEscola),
          }
        }
        try {
          const setup = await garantirDadosEscola(supabase, escolaId, {
            completo: false,
            tipo: tipoEscola,
          })
          const partes = setup.mensagem ? [setup.mensagem] : []

          const { data: turmasData } = await supabase
            .from("turmas")
            .select("id, nome, periodo")
            .eq("escola_id", escolaId)
          if (!turmasData?.length) {
            return {
              ok: false,
              mensagem:
                partes.join("\n\n") ||
                "Não foi possível criar turmas para o recreio.",
            }
          }

          const apiRes = await fetch("/api/ia/gerar-recreio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              turmas: turmasData,
              espacosDisponiveis: 2,
              duracao: 20,
            }),
          })

          const payload = await apiRes.json()
          if (!apiRes.ok)
            return { ok: false, mensagem: payload.error || `Erro ao organizar recreio` }

          const resultado = await persistRecreioIntercalado(
            supabase,
            escolaId,
            payload,
            turmasData
          )

          if (resultado.ok) {
            await supabase.from("eventos_tempo_real").insert({
              escola_id: escolaId,
              tipo: "inicio_recreio",
              mensagem: `Recreio intercalado organizado pela IA para ${resultado.count} turma(s)!`,
            })
          }

          if (partes.length) {
            return {
              ok: resultado.ok,
              mensagem: `${partes.join("\n\n")}\n\n${resultado.ok ? "✅" : "❌"} ${resultado.mensagem}`,
            }
          }
          return resultado
        } catch (e) {
          return {
            ok: false,
            mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}`,
          }
        }
      }

      // ========== EVENTOS ==========
      case "listar_eventos": {
        const { data } = await supabase
          .from("eventos_tempo_real")
          .select("*, professor:professores(nome), turma:turmas(nome)")
          .eq("escola_id", escolaId)
          .order("created_at", { ascending: false })
          .limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhum evento registrado ainda." }
        const lista = data
          .map((e) => {
            const hora = new Date(e.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
            return `• \`${hora}\` — ${e.mensagem}`
          })
          .join("\n")
        return { ok: true, mensagem: `**📌 Eventos Recentes:**\n\n${lista}` }
      }

      // ========== RESUMO ==========
      case "resumo_semanal": {
        const hoje = new Date()
        const semanaAtras = new Date(hoje.getTime() - 7 * 86400000).toISOString().split("T")[0]

        const [tRes, pRes, fRes, sRes, eRes, gRes] = await Promise.all([
          supabase
            .from("turmas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
          supabase.from("professores").select("id,status").eq("escola_id", escolaId),
          supabase
            .from("faltas")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId)
            .gte("data", semanaAtras),
          supabase
            .from("substituicoes")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId)
            .eq("status", "pendente"),
          supabase
            .from("eventos_tempo_real")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId)
            .gte("created_at", semanaAtras),
          supabase
            .from("grade_horarios")
            .select("id", { count: "exact", head: true })
            .eq("escola_id", escolaId),
        ])

        const presentes = pRes.data?.filter((p) => p.status === "presente").length || 0
        const ausentes = pRes.data?.filter((p) => p.status !== "presente").length || 0
        const scorePresenca =
          pRes.data?.length ? Math.round((presentes / pRes.data.length) * 100) : 0

        return {
          ok: true,
          mensagem: `**📊 Resumo Semanal**\n\n🏫 Turmas: ${tRes.count || 0}\n👥 Professores: ${pRes.data?.length || 0}\n  ✅ Presentes: ${presentes} (${scorePresenca}%)\n  ❌ Ausentes: ${ausentes}\n📋 Faltas (7 dias): ${fRes.count || 0}\n🔄 Substituições pendentes: ${sRes.count || 0}\n📅 Aulas na grade: ${gRes.count || 0}\n📌 Eventos (7 dias): ${eRes.count || 0}\n\n${scorePresenca >= 80 ? "🌟 Semana com boa frequência!" : scorePresenca >= 60 ? "⚡ Frequência moderada, fique atento." : "⚠️ Frequência baixa — considere ações!"}`,
        }
      }

      default:
        return {
          ok: false,
          mensagem: `Ação "${acao}" não reconhecida pelo sistema.`,
        }
    }
  }

  const handleSugestao = useCallback(
    (texto: string) => {
      setInput(texto)
      setShowSugestoes(false)
      inputRef.current?.focus()
    },
    []
  )

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
      // Upload de anexo
      if (anexo) {
        const formData = new FormData()
        formData.append("file", anexo)
        formData.append("professor", textoUsuario)
        const upRes = await fetch("/api/upload", { method: "POST", body: formData })
        const upData = await upRes.json().catch(() => ({}))
        if (!upRes.ok) {
          addMensagem({
            role: "assistant",
            content: `❌ ${upData.error || "Erro ao enviar o arquivo."}`,
            isError: true,
          })
          setLoading(false)
          setIsTyping(false)
          return
        }
        if (upData.faltaRegistrada) {
          addMensagem({
            role: "assistant",
            content: `✅ ${upData.message || "Atestado enviado e falta registrada!"}`,
          })
        }
        setAnexo(null)
        if (!textoUsuario.trim()) {
          setLoading(false)
          setIsTyping(false)
          return
        }
      }

      // Pega contexto da escola para enriquecer a IA
      const {
        data: { user },
      } = await supabase.auth.getUser()
      let contexto = {}
      if (user) {
        try {
          contexto = await getContexto(user.id)
        } catch {
          // ignora erro de contexto
        }
      }

      const historico = mensagens
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content.slice(0, 900),
        }))

      const res = await fetch("/api/ia/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comando: textoUsuario, contexto, historico }),
      })

      const data = await res.json()

      if (data.acao === "responder_pergunta" && (data.resposta || data.params?.resposta)) {
        addMensagem({
          role: "assistant",
          content: data.resposta || data.params.resposta,
          acao: data.acao,
        })
        return
      }

      if (!data.acao || data.acao === "desconhecido" || data.acao === "erro") {
        addMensagem({
          role: "assistant",
          content:
            data.resposta ||
            data.mensagem ||
            '❓ Não entendi. Tente: "liste professores", "crie turma X", "gere a grade"...',
          isError: data.acao === "erro",
        })
        return
      }

      const acaoExec = normalizarAcaoComando(data.acao) || data.acao
      const paramsNorm = normalizarParamsComando(
        acaoExec,
        { ...(data.params || {}), _comando: textoUsuario },
        textoUsuario
      )
      const resultado = await executarAcao(acaoExec, paramsNorm)
      const emoji = resultado.ok ? "✅" : "❌"
      addMensagem({
        role: "assistant",
        content: `${emoji} ${resultado.mensagem || "Comando executado!"}`,
        acao: acaoExec,
        isError: !resultado.ok,
      })

      if (resultado.ok) {
        fetch("/api/ia/memoria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fato: `${textoUsuario.slice(0, 150)} → ${resultado.mensagem.slice(0, 200)}`,
            acao: data.acao,
          }),
        }).catch(() => {})
      }
    } catch (err) {
      addMensagem({
        role: "assistant",
        content: `❌ ${formatIaError(err)}`,
        isError: true,
      })
    } finally {
      setLoading(false)
      setIsTyping(false)
    }
  }

  const floatingUi = (
    <>
      {aberto && (
      <div
        ref={panelRef}
        className="aria-chat-panel fixed z-[9998] flex flex-col rounded-[var(--aria-radius-lg)] transition-all duration-300 overflow-hidden max-h-[calc(100dvh-2rem)] animate-slide-up"
        style={{
          bottom: "1.5rem",
          right: "1.5rem",
          width: "min(400px, calc(100vw - 2rem))",
          height: "min(480px, calc(100dvh - 6rem))",
          position: "fixed",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--aria-border)" }}
        >
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" style={{ color: "var(--aria-accent)" }} strokeWidth={2} />
            <span className="font-semibold text-sm tracking-wide" style={{ color: "var(--aria-text)" }}>
              ARIA
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSugestoes((s) => !s)}
              className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10"
              title="Sugestões"
            >
              <Lightbulb className="h-4 w-4 text-yellow-400" />
            </button>
            <button
              onClick={limpar}
              className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10"
              title="Limpar conversa"
            >
              <Trash2 className="h-4 w-4 opacity-60" />
            </button>
            <button
              onClick={() => setAberto(false)}
              className="p-1.5 rounded-lg cursor-pointer transition-colors hover:bg-white/10"
            >
              <X className="h-4 w-4 opacity-60" />
            </button>
          </div>
        </div>

        {/* Sugestões rápidas */}
        {showSugestoes && (
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: "var(--aria-border)", backgroundColor: "var(--aria-accent-soft)" }}
          >
            <p className="text-xs mb-2" style={{ color: "var(--aria-accent)" }}>
              Sugestões
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoesRapidas.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSugestao(s.replace(/^[^\s]+\s/, ""))}
                  className="text-xs px-2 py-1 rounded-lg cursor-pointer transition-all hover:scale-105"
                  style={{
                    backgroundColor: "var(--aria-surface-hover)",
                    border: "1px solid var(--aria-border-strong)",
                    color: "var(--aria-text-muted)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mensagens */}
        <div
          ref={chatRef}
          className="flex-1 min-h-0 overflow-y-auto space-y-3 px-4 py-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(99,102,241,0.3) transparent" }}
        >
          {mensagens.map((msg) => (
            <MensagemBubble key={msg.id} msg={msg} />
          ))}
          {isTyping && <TypingIndicator />}
        </div>

        {/* Formulário de input */}
        <form
          onSubmit={handleSubmit}
          className="border-t px-4 py-3"
          style={{ borderColor: "var(--aria-border)", backgroundColor: "rgba(0,0,0,0.25)" }}
        >
          {anexo && (
            <div
              className="mb-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs"
              style={{
                backgroundColor: "var(--aria-accent-soft)",
                border: "1px solid var(--aria-border)",
              }}
            >
              <Paperclip className="h-3 w-3 text-indigo-400" />
              <span className="text-indigo-300 flex-1 truncate">{anexo.name}</span>
              <button
                type="button"
                onClick={() => setAnexo(null)}
                className="text-red-400 cursor-pointer hover:text-red-300"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-shrink-0 cursor-pointer p-2 rounded-lg transition-all hover:bg-white/10"
              style={{ color: "var(--aria-accent)" }}
              title="Anexar atestado"
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
              placeholder="Digite um comando ou pergunta..."
              className="field-base flex-1 rounded-[var(--aria-radius)]"
              style={{
                borderColor: input ? "rgba(34,211,238,0.4)" : undefined,
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !anexo)}
              className="flex-shrink-0 flex items-center justify-center rounded-[var(--aria-radius)] p-2.5 cursor-pointer disabled:opacity-40 transition-all hover:brightness-110 active:scale-95 aria-btn-send"
              style={{ background: loading ? "var(--aria-text-subtle)" : undefined }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 text-[#050508] animate-spin" />
              ) : (
                <Send className="h-4 w-4 text-[#050508]" />
              )}
            </button>
          </div>

          <p className="mt-1.5 text-center text-xs" style={{ color: "var(--aria-text-subtle)" }}>
            ARIA — assistente da escola
          </p>
        </form>
      </div>
      )}
    </>
  )

  if (!portalReady || typeof document === "undefined") {
    return null
  }

  if (!aberto) return null

  return createPortal(floatingUi, document.body)
}
