import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { responderPergunta } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const { pergunta, contexto } = await request.json()

    if (!pergunta) {
      return NextResponse.json({ error: "Pergunta vazia" }, { status: 400 })
    }

    const resultado = await responderPergunta(pergunta, contexto || {})
    return NextResponse.json({ ...resultado, modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}