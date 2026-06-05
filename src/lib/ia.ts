import { chamarIAArray, chamarIAComFallback, chamarIAJsonComFallback } from "./ia-client"
import type { IaMessage } from "./ia-client"
import { compactEscolaPayload } from "./ia-utils"

export async function gerarGradeHorarios(
  turmas: unknown[],
  materias: unknown[],
  professores: unknown[],
  periodos: unknown[],
  gradeAtual: unknown[] = []
) {
  const systemMsg: IaMessage = {
    role: "system",
    content: `Você é um especialista em gestão escolar. Gere uma grade horária semanal COMPLETA e BALANCEADA para uma escola brasileira.

REGRAS:
- Cada turma deve ter aulas distribuídas de segunda a sexta (dias 0-4)
- Não coloque o mesmo professor em duas turmas no mesmo horário/dia
- Distribua as matérias de forma equilibrada
- Use os IDs exatos fornecidos nos dados

RETORNE JSON:
{ "aulas": [ { "turma_id": "uuid", "materia_id": "uuid", "professor_id": "uuid", "dia_semana": 0-4, "periodo_id": "uuid" } ] }

Gere o máximo de aulas possível (pelo menos 5 por turma, se houver professores disponíveis).`,
  }

  const userMsg: IaMessage = {
    role: "user",
    content: JSON.stringify(
      compactEscolaPayload({ turmas, materias, professores, periodos, gradeAtual })
    ),
  }

  return chamarIAArray([systemMsg, userMsg], ["aulas", "grade", "horarios", "items"], {
    temperature: 0.2,
    max_tokens: 6144,
  })
}

export async function sugerirSubstituto(
  professorAusente: unknown,
  professoresDisponiveis: unknown[],
  materia: string,
  horario: unknown
) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Você é um coordenador escolar experiente. Sugira o MELHOR substituto considerando:
1. Compatibilidade de especialidade/matéria
2. Carga horária disponível  
3. Histórico de substituições anteriores

RETORNE JSON: { "substituto": "nome_completo", "substituto_id": "uuid_ou_null", "justificativa": "texto explicando a escolha", "confianca": 0-100 }`,
    },
    {
      role: "user",
      content: JSON.stringify({ professorAusente, professoresDisponiveis, materia, horario }),
    },
  ]
  return chamarIAJsonComFallback(msgs, { temperature: 0.3 })
}

export async function gerarRecreioIntercalado(
  turmas: unknown[],
  espacosDisponiveis: number,
  duracao: number
) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Organize recreios intercalados para uma escola brasileira. 
REGRAS:
- Nunca duas turmas no recreio ao mesmo tempo (use espaços disponíveis: ${espacosDisponiveis})
- Duração de cada recreio: ${duracao} minutos
- Distribua ao longo de segunda a sexta (dias 0-4)
- Horários típicos: 09:00-10:00 para manhã, 15:00-16:00 para tarde

RETORNE JSON: { "horarios": [ { "turma_nome": "nome", "turma_id": "uuid_ou_null", "dia_semana": 0-4, "hora_inicio": "HH:MM", "hora_fim": "HH:MM" } ] }`,
    },
    {
      role: "user",
      content: JSON.stringify({ turmas, espacosDisponiveis, duracao }),
    },
  ]

  return chamarIAArray(msgs, ["horarios", "recreios", "items"], { temperature: 0.3 })
}

export async function analisarEscola(dados: {
  turmas: unknown[]
  professores: unknown[]
  materias: unknown[]
  faltas: unknown[]
  substituicoes: unknown[]
  grade: unknown[]
}) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Você é um analista educacional especialista em gestão escolar brasileira. 
Analise os dados fornecidos e gere um relatório completo com:
1. Pontos fortes da escola
2. Problemas identificados (faltas excessivas, conflitos, turmas sem professor, etc.)
3. Recomendações prioritárias
4. Insights sobre padrões de comportamento

RETORNE JSON:
{
  "pontos_fortes": ["item1", "item2"],
  "problemas": [{"titulo": "...", "descricao": "...", "gravidade": "alta|media|baixa"}],
  "recomendacoes": [{"acao": "...", "impacto": "...", "prioridade": 1-10}],
  "insights": ["insight1", "insight2"],
  "nota_geral": 0-10,
  "resumo_executivo": "texto"
}`,
    },
    {
      role: "user",
      content: JSON.stringify(
        compactEscolaPayload({
          turmas: dados.turmas,
          materias: dados.materias,
          professores: dados.professores,
          gradeAtual: (dados.grade || []).slice(0, 50),
        })
      ),
    },
  ]
  return chamarIAJsonComFallback(msgs, { temperature: 0.4, max_tokens: 4096 })
}

export async function sugerirMelhorias(dados: {
  turmas: unknown[]
  professores: unknown[]
  grade: unknown[]
  faltas: unknown[]
}) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Você é um consultor de educação. Sugira melhorias concretas e acionáveis para otimizar a gestão desta escola.

RETORNE JSON:
{
  "melhorias": [
    {
      "categoria": "grade|professores|faltas|turmas|geral",
      "titulo": "...",
      "descricao": "...",
      "acao_recomendada": "comando específico que o usuário pode dar à IA",
      "impacto_esperado": "...",
      "urgencia": "imediata|esta_semana|este_mes"
    }
  ]
}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        turmas: (dados.turmas || []).slice(0, 30),
        professores: (dados.professores || []).slice(0, 40),
        faltas: (dados.faltas || []).slice(0, 40),
        grade: (dados.grade || []).slice(0, 30),
      }),
    },
  ]
  return chamarIAJsonComFallback(msgs, { temperature: 0.5, max_tokens: 3000 })
}

export async function relatorioProfessor(
  professor: unknown,
  faltas: unknown[],
  substituicoes: unknown[],
  aulas: unknown[]
) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Gere um relatório profissional completo sobre um professor. Seja objetivo e construtivo.

RETORNE JSON:
{
  "nome": "...",
  "resumo": "...",
  "total_faltas": 0,
  "total_substituicoes_realizadas": 0,
  "total_aulas": 0,
  "frequencia_percent": 0-100,
  "avaliacao": "excelente|otimo|bom|regular|preocupante",
  "pontos_positivos": ["..."],
  "pontos_atencao": ["..."],
  "recomendacao": "..."
}`,
    },
    {
      role: "user",
      content: JSON.stringify({ professor, faltas, substituicoes, aulas }),
    },
  ]
  return chamarIAJsonComFallback(msgs, { temperature: 0.3, max_tokens: 2000 })
}

export async function responderPergunta(
  pergunta: string,
  contexto: {
    turmas?: unknown[]
    professores?: unknown[]
    materias?: unknown[]
    eventos?: unknown[]
  }
) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Você é ARIA, assistente de gestão escolar brasileira. Responda em português.
Você EXECUTA ações no sistema via comandos — oriente o usuário a pedir ações diretas quando aplicável.
Dados: ${JSON.stringify(contexto).substring(0, 2000)}`,
    },
    { role: "user", content: pergunta },
  ]

  const content = await chamarIAComFallback(msgs, { temperature: 0.5, max_tokens: 1000 })
  return { resposta: content }
}

export async function preverFaltas(
  historicoProfessores: unknown[],
  diasSemana: unknown[]
) {
  const msgs: IaMessage[] = [
    {
      role: "system",
      content: `Analise o histórico de faltas e identifique padrões preditivos.

RETORNE JSON:
{
  "previsoes": [
    {
      "professor_nome": "...",
      "risco": "alto|medio|baixo",
      "probabilidade_percent": 0-100,
      "motivo_inferido": "...",
      "dias_mais_criticos": ["segunda", "terca", etc],
      "recomendacao": "..."
    }
  ],
  "padrao_geral": "...",
  "alerta": "texto geral de alerta se houver risco alto"
}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        historicoProfessores: (historicoProfessores || []).slice(0, 25),
        diasSemana,
      }),
    },
  ]
  return chamarIAJsonComFallback(msgs, { temperature: 0.3 })
}