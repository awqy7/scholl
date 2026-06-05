import { chamarIAJson } from "@/lib/ia-client"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { turmas, materias, professores, periodos, gradeAtual } = body

    const result = await chamarIAJson([
      {
        role: "system",
        content: `Você é um especialista em gestão escolar criando grade horária semanal.
Regras:
- Distribua as matérias uniformemente na semana (seg-sex)
- Um professor NÃO pode estar em duas turmas ao mesmo tempo
- Respeite carga horária dos professores
- Priorize professores com especialidades compatíveis
- Retorne JSON array com objetos: turma_id, materia_id, professor_id, dia_semana (0-4), periodo_id
Analise a grade atual (se existir) e melhore-a.`,
      },
      {
        role: "user",
        content: JSON.stringify({ turmas, materias, professores, periodos, gradeAtual }),
      },
    ])

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return Response.json({ error: message }, { status: 500 })
  }
}
