import { NextResponse } from "next/server"
import { sugerirSubstituto } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { professorAusente, professoresDisponiveis, materia, horario } = body

    if (!professorAusente) {
      return NextResponse.json({ error: "Professor ausente não informado." }, { status: 400 })
    }

    const resultado = await sugerirSubstituto(
      professorAusente,
      professoresDisponiveis || [],
      materia || "",
      horario
    )

    return NextResponse.json({ ...((resultado as object) || {}), modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}