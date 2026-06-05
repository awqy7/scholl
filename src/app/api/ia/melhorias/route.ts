import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { sugerirMelhorias } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const dados = await request.json()

    const resultado = await sugerirMelhorias({
      turmas: dados.turmas || [],
      professores: dados.professores || [],
      grade: dados.grade || [],
      faltas: dados.faltas || [],
    })

    return NextResponse.json({ ...((resultado as object) || {}), modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}