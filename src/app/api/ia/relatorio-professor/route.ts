import { NextResponse } from "next/server"
import { relatorioProfessor } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const { professor, faltas, substituicoes, aulas } = await request.json()

    if (!professor) {
      return NextResponse.json({ error: "Professor não informado." }, { status: 400 })
    }

    const resultado = await relatorioProfessor(
      professor,
      faltas || [],
      substituicoes || [],
      aulas || []
    )

    return NextResponse.json({ ...((resultado as object) || {}), modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}