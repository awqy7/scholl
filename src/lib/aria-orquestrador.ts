import { chamarIAJsonComFallback, chamarIAComFallback, type IaMessage } from "./ia-client"
import { buildSystemPrompt, isComandoMutacao } from "./ia-comando"
import { formatarMemoriaParaPrompt, type AriaMemoria } from "./aria-memoria"
import { parseIaJsonContent } from "./ia-utils"

export interface TurnoHistorico {
  role: "user" | "assistant"
  content: string
}

export function montarMensagensOrquestrador(opts: {
  contexto?: Record<string, unknown>
  comando: string
  historico?: TurnoHistorico[]
  memoria?: AriaMemoria
}): IaMessage[] {
  const system = buildSystemPrompt(
    opts.contexto as {
      tipoEscola?: string
      professores?: number
      turmas?: number
      materias?: number
      nomesProfessores?: string[]
      horaAtual?: string
    }
  )

  const memoriaTxt = opts.memoria ? formatarMemoriaParaPrompt(opts.memoria) : ""
  const systemFull = memoriaTxt
    ? `${system}\n\nMEMÓRIA DESTA ESCOLA (use para continuidade com o diretor):\n${memoriaTxt}`
    : system

  const msgs: IaMessage[] = [{ role: "system", content: systemFull }]

  for (const turno of (opts.historico || []).slice(-10)) {
    const role = turno.role === "user" ? "user" : "assistant"
    const content = turno.content?.trim().slice(0, 900)
    if (content) msgs.push({ role, content })
  }

  msgs.push({ role: "user", content: opts.comando })
  return msgs
}

export async function interpretarComandoAria(opts: {
  comando: string
  contexto?: Record<string, unknown>
  historico?: TurnoHistorico[]
  memoria?: AriaMemoria
}) {
  const messages = montarMensagensOrquestrador(opts)
  const maxTokens = Math.min(2048, 700 + opts.comando.length * 2)

  const parsed = await chamarIAJsonComFallback(messages, {
    temperature: 0.08,
    max_tokens: maxTokens,
  })

  return parsed as {
    acao?: string
    params?: Record<string, unknown>
    confianca?: number
    explicacao?: string
  }
}

/** Conversa livre com o diretor (Groq) — mantém tom de gestora escolar */
export async function conversarComDiretor(opts: {
  pergunta: string
  contextoEscola?: Record<string, unknown>
  historico?: TurnoHistorico[]
  memoria?: AriaMemoria
}): Promise<string> {
  const memoriaTxt = opts.memoria ? formatarMemoriaParaPrompt(opts.memoria) : ""
  const ctx = opts.contextoEscola
    ? `\nDados atuais da escola: ${JSON.stringify(opts.contextoEscola).slice(0, 2500)}`
    : ""

  const system: IaMessage = {
    role: "system",
    content: `Você é ARIA, assistente executiva de gestão escolar brasileira. Converse com o diretor de forma clara e prática.
Você pode executar ações no sistema — quando o diretor pedir criar, editar, listar, substituir ou gerar grade, sugira o comando exato ou diga que vai executar.
${memoriaTxt ? `\nMemória:\n${memoriaTxt}` : ""}${ctx}`,
  }

  const msgs: IaMessage[] = [system]
  for (const t of (opts.historico || []).slice(-10)) {
    if (t.content?.trim()) {
      msgs.push({
        role: t.role === "user" ? "user" : "assistant",
        content: t.content.slice(0, 900),
      })
    }
  }
  msgs.push({ role: "user", content: opts.pergunta })

  return chamarIAComFallback(msgs, { temperature: 0.45, max_tokens: 1200 })
}

const PREFIXOS_ACAO_EXECUTAVEL = [
  "criar_",
  "editar_",
  "deletar_",
  "listar_",
  "registrar_",
  "gerar_",
  "montar_",
  "limpar_",
  "adicionar_",
  "remover_",
  "alterar_",
  "confirmar_",
  "recusar_",
  "cancelar_",
  "justificar_",
  "analisar_",
  "sugerir_",
  "otimizar_",
  "prever_",
  "relatorio_",
  "detalhes_",
  "status_",
  "resumo_",
  "verificar_",
  "turmas_",
  "professores_",
  "faltas_",
  "professor_",
] as const

export function deveExecutarAcao(comando: string, acao?: string): boolean {
  if (!acao || acao === "desconhecido" || acao === "erro") return false
  if (acao === "responder_pergunta") return false
  if (PREFIXOS_ACAO_EXECUTAVEL.some((p) => acao.startsWith(p))) return true
  return isComandoMutacao(comando)
}