import { NextResponse } from "next/server"
import { chamarIAArray } from "@/lib/ia-client"
import { requireApiUser } from "@/lib/api-auth"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { turmas, materias, professores, periodos, gradeAtual } = body

    const aulas = await chamarIAArray(
      [
        {
          role: "system",
          content: `Você cria grade horária escolar semanal (seg-sex, dia_semana 0-4).
Regras: sem conflito de professor no mesmo horário; respeitar carga horária; especialidades compatíveis.
Retorne JSON: { "aulas": [ { "turma_id", "materia_id", "professor_id", "dia_semana", "periodo_id" } ] }
Use APENAS ids fornecidos nos dados.`,
        },
        {
          role: "user",
          content: JSON.stringify({ turmas, materias, professores, periodos, gradeAtual }),
        },
      ],
      ["aulas", "grade", "horarios", "items"]
    )

    return NextResponse.json(aulas)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}