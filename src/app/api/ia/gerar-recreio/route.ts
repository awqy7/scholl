import { NextResponse } from "next/server"
import { gerarRecreioIntercalado } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { turmas, espacosDisponiveis, duracao } = body

    if (!turmas?.length) {
      return NextResponse.json({ error: "Nenhuma turma informada." }, { status: 400 })
    }

    const horarios = await gerarRecreioIntercalado(
      turmas,
      espacosDisponiveis ?? 2,
      duracao ?? 20
    )

    if (!horarios.length) {
      return NextResponse.json(
        { error: "A IA não retornou horários de recreio válidos." },
        { status: 422 }
      )
    }

    return NextResponse.json({ horarios, modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}