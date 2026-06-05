import { NextResponse } from "next/server"
import {
  adicionarFatoMemoria,
  atualizarResumoMemoria,
  carregarMemoria,
} from "@/lib/aria-memoria"
import { requireApiUser } from "@/lib/api-auth"

export async function GET() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const memoria = await carregarMemoria(auth.supabase, auth.escolaId)
  return NextResponse.json(memoria)
}

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { fato, resumo, acao } = body

    if (resumo && typeof resumo === "string") {
      await atualizarResumoMemoria(auth.supabase, auth.escolaId, resumo)
    }

    if (fato && typeof fato === "string") {
      const memoria = await adicionarFatoMemoria(
        auth.supabase,
        auth.escolaId,
        fato,
        typeof acao === "string" ? acao : undefined
      )
      return NextResponse.json(memoria)
    }

    const memoria = await carregarMemoria(auth.supabase, auth.escolaId)
    return NextResponse.json(memoria)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar memória"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}