import { chamarIA } from "./ia-client"

export async function gerarGradeHorarios(
  turmas: any[],
  materias: any[],
  professores: any[],
  periodos: any[]
) {
  const content = await chamarIA([
    {
      role: "system",
      content: `Você é um especialista em gestão escolar e criação de horários.
Gere uma grade de horários semanal (seg-sex) otimizada.
Distribua as matérias uniformemente, sem conflitos de horário para professores.
Retorne APENAS JSON array válido.`,
    },
    { role: "user", content: JSON.stringify({ turmas, materias, professores, periodos }) },
  ])
  return JSON.parse(content.replace(/```json|```/g, "").trim())
}

export async function sugerirSubstituto(
  professorAusente: any,
  professoresDisponiveis: any[],
  materia: string,
  horario: any
) {
  const content = await chamarIA([
    {
      role: "system",
      content: `Você é um coordenador escolar encontrando o melhor substituto.
Analise: especialidades, disponibilidade, carga horária.
Retorne APENAS JSON: { "substituto": "nome", "justificativa": "texto" }`,
    },
    {
      role: "user",
      content: JSON.stringify({ professorAusente, professoresDisponiveis, materia, horario }),
    },
  ])
  return JSON.parse(content.replace(/```json|```/g, "").trim())
}

export async function gerarRecreioIntercalado(
  turmas: any[],
  espacosDisponiveis: number,
  duracao: number
) {
  const content = await chamarIA([
    {
      role: "system",
      content: `Você organiza recreios intercalados para creche.
Apenas UMA turma por vez. Respeite período (manha/tarde). Intervalo mínimo de 10min.
Retorne APENAS JSON array de { turma, inicio, fim }`,
    },
    { role: "user", content: JSON.stringify({ turmas, espacosDisponiveis, duracao }) },
  ])
  return JSON.parse(content.replace(/```json|```/g, "").trim())
}
