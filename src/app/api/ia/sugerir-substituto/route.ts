import { chamarIAJson } from "@/lib/ia-client"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { professorAusente, professoresDisponiveis, materia, horario } = body

    const result = await chamarIAJson([
      {
        role: "system",
        content: `Você é um coordenador escolar.
Encontre o melhor professor substituto baseado em:
- Especialidades compatíveis com a matéria
- Disponibilidade (status presente)
- Carga horária disponível
Retorne JSON: { "substituto": "nome completo", "justificativa": "texto curto" }`,
      },
      {
        role: "user",
        content: JSON.stringify({ professorAusente, professoresDisponiveis, materia, horario }),
      },
    ])

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return Response.json({ error: message }, { status: 500 })
  }
}
