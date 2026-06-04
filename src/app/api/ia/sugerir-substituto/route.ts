import { NextResponse } from "next/server"
import { chamarIAJson } from "@/lib/ia-client"
import { requireApiUser } from "@/lib/api-auth"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { professorAusente, professoresDisponiveis, materia, horario } = body

    const result = await chamarIAJson([
      {
        role: "system",
        content: `Você é coordenador escolar. Escolha o melhor substituto.
Retorne JSON: { "substituto": "nome completo exato da lista", "justificativa": "texto curto" }`,
      },
      {
        role: "user",
        content: JSON.stringify({ professorAusente, professoresDisponiveis, materia, horario }),
      },
    ])

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}