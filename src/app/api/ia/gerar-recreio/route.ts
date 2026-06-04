import { NextResponse } from "next/server"
import { chamarIAArray } from "@/lib/ia-client"
import { requireApiUser } from "@/lib/api-auth"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const body = await request.json()
    const { turmas, espacosDisponiveis, duracao } = body

    const horarios = await chamarIAArray(
      [
        {
          role: "system",
          content: `Você organiza recreios intercalados para creche.
Regras: APENAS UMA turma por vez; respeitar período manha/tarde; intervalo mínimo 10min.
Retorne JSON: { "horarios": [ { "turma_nome", "dia_semana": 0-4, "hora_inicio": "HH:MM", "hora_fim": "HH:MM" } ] }`,
        },
        {
          role: "user",
          content: JSON.stringify({ turmas, espacosDisponiveis, duracao }),
        },
      ],
      ["horarios", "recreios", "items"]
    )

    return NextResponse.json(horarios)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}