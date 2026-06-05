import { NextResponse } from "next/server"
import { conversarComDiretor } from "@/lib/aria-orquestrador"
import { carregarMemoria, adicionarFatoMemoria } from "@/lib/aria-memoria"
import { formatIaError } from "@/lib/ia-utils"
import { getProvedorAtivo } from "@/lib/ia-client"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { mensagem, contexto, historico, salvar_memoria } = body

    if (!mensagem || typeof mensagem !== "string") {
      return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 })
    }

    const memoria = await carregarMemoria(auth.supabase, auth.escolaId)

    const resposta = await conversarComDiretor({
      pergunta: mensagem,
      contextoEscola: contexto,
      historico: historico || [],
      memoria,
    })

    if (salvar_memoria !== false) {
      await adicionarFatoMemoria(
        auth.supabase,
        auth.escolaId,
        `Diretor: ${mensagem.slice(0, 120)}`,
        "conversa"
      )
    }

    return NextResponse.json({
      resposta,
      modo: "ia",
      provedor: getProvedorAtivo(),
    })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}