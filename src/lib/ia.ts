import { chamarIAArray } from "./ia-client"

export async function gerarGradeHorarios(
  turmas: unknown[],
  materias: unknown[],
  professores: unknown[],
  periodos: unknown[],
  gradeAtual: unknown[] = []
) {
  return chamarIAArray(
    [
      {
        role: "system",
        content: `Gere grade semanal otimizada. Retorne JSON: { "aulas": [ { turma_id, materia_id, professor_id, dia_semana, periodo_id } ] }`,
      },
      { role: "user", content: JSON.stringify({ turmas, materias, professores, periodos, gradeAtual }) },
    ],
    ["aulas", "grade"]
  )
}

export async function sugerirSubstituto(
  professorAusente: unknown,
  professoresDisponiveis: unknown[],
  materia: string,
  horario: unknown
) {
  const { chamarIAJson } = await import("./ia-client")
  return chamarIAJson([
    {
      role: "system",
      content: `Retorne JSON: { "substituto": "nome", "justificativa": "texto" }`,
    },
    { role: "user", content: JSON.stringify({ professorAusente, professoresDisponiveis, materia, horario }) },
  ])
}

export async function gerarRecreioIntercalado(
  turmas: unknown[],
  espacosDisponiveis: number,
  duracao: number
) {
  return chamarIAArray(
    [
      {
        role: "system",
        content: `Recreio intercalado. Retorne JSON: { "horarios": [ { turma_nome, dia_semana, hora_inicio, hora_fim } ] }`,
      },
      { role: "user", content: JSON.stringify({ turmas, espacosDisponiveis, duracao }) },
    ],
    ["horarios", "recreios"]
  )
}