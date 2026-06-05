import { NextResponse } from "next/server"
import { gerarGradeHorarios } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 90

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { turmas, materias, professores, periodos, gradeAtual } = body

    if (!turmas?.length || !materias?.length || !professores?.length || !periodos?.length) {
      return NextResponse.json(
        { error: "Dados insuficientes para gerar a grade." },
        { status: 400 }
      )
    }

    const aulas = await gerarGradeHorarios(
      turmas,
      materias,
      professores,
      periodos,
      gradeAtual || []
    )

    if (!aulas.length) {
      return NextResponse.json(
        { error: "A IA não retornou aulas válidas. Tente o comando novamente." },
        { status: 422 }
      )
    }

    return NextResponse.json({ aulas, modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}