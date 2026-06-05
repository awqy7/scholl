import { chamarIAJson } from "@/lib/ia-client"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { turmas, espacosDisponiveis, duracao } = body

    const result = await chamarIAJson([
      {
        role: "system",
        content: `Você organiza recreios intercalados para creche.
Regras:
- APENAS UMA turma por vez no recreio
- Respeite período (manha/tarde)
- Intervalo mínimo de 10min entre turmas
- Retorne JSON array: [{ "turma_nome": "...", "dia_semana": 0-4, "hora_inicio": "HH:MM", "hora_fim": "HH:MM" }]`,
      },
      {
        role: "user",
        content: JSON.stringify({ turmas, espacosDisponiveis, duracao }),
      },
    ])

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return Response.json({ error: message }, { status: 500 })
  }
}
