import { NextResponse } from "next/server"
import { chamarIA } from "@/lib/ia-client"
import { parseIaJsonContent } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"
import {
  buildSystemPrompt,
  parseComandoSimples,
  isAcaoValida,
  type DecisaoComando,
} from "@/lib/ia-comando"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const { comando } = await request.json()
    if (!comando || typeof comando !== "string") {
      return NextResponse.json({ error: "Comando vazio" }, { status: 400 })
    }

    let decisao: DecisaoComando | null = null

    const modelosFallback = [
      process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
      "openrouter/free",
      "mistralai/mistral-nemo",
    ]

    for (const modelo of modelosFallback) {
      try {
        const content = await chamarIA(
          [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: comando },
          ],
          { temperature: 0.1 },
          modelo
        )

        const parsed = parseIaJsonContent(content) as { acao?: string; params?: Record<string, unknown> }
        if (parsed?.acao && isAcaoValida(parsed.acao)) {
          decisao = { acao: parsed.acao, params: parsed.params || {} }
          break
        }
      } catch {
        decisao = null
      }
    }

    if (!decisao) {
      const fallback = parseComandoSimples(comando)
      if (fallback) decisao = fallback
    }

    if (!decisao) {
      return NextResponse.json({
        resposta:
          'Não entendi. Exemplos: "crie turma Maternal C", "Maria Silva faltou", "gere a grade", "liste professores", "organize o recreio".',
        acao: "desconhecido",
      })
    }

    return NextResponse.json({
      acao: decisao.acao,
      params: decisao.params,
      sucesso: true,
      mensagem: `Entendi! Vou ${String(decisao.acao).replace(/_/g, " ")}.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return NextResponse.json({ resposta: `Erro: ${message}`, acao: "erro" }, { status: 500 })
  }
}