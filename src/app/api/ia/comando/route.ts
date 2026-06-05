import { NextResponse } from "next/server"
import { chamarIA } from "@/lib/ia-client"

// ===== PARSER SEM IA (fallback) =====
function parseComandoSimples(comando: string) {
  const c = comando.toLowerCase().trim()

  if (/status|resumo|painel|geral/.test(c)) {
    return { acao: "status_sistema", params: {} }
  }
  if (/liste?|mostre?|professor/.test(c)) {
    return { acao: "listar_professores", params: {} }
  }
  if (/liste?|mostre?|turma/.test(c)) {
    return { acao: "listar_turmas", params: {} }
  }
  if (/liste?|mostre?|mat[eé]ria/.test(c)) {
    return { acao: "listar_materias", params: {} }
  }

  // criar
  const turmaMatch = c.match(/cri[aei]r?\s+(?:uma\s+)?(?:turma|sala|classe)\s+(.+)/i)
  if (turmaMatch) {
    return { acao: "criar_turma", params: { nome: turmaMatch[1].trim() } }
  }

  const profMatch = c.match(/cri[aei]r?\s+(?:um|o|a)\s+professor\s+(.+)/i)
  if (profMatch) {
    return { acao: "criar_professor", params: { nome: profMatch[1].trim() } }
  }

  const matMatch = c.match(/cri[aei]r?\s+(?:materia|mat[eé]ria)\s+(.+)/i)
  if (matMatch) {
    return { acao: "criar_materia", params: { nome: matMatch[1].trim() } }
  }

  const faltaMatch = c.match(/(.+?)\s+faltou/i)
  if (faltaMatch) {
    return { acao: "registrar_falta", params: { professor_nome: faltaMatch[1].trim() } }
  }

  // deletar
  const delTurma = c.match(/delet[aei]r?|remover|apag[aei]r?\s+(?:a\s+)?(?:turma|sala|classe)\s+(.+)/i)
  if (delTurma) {
    return { acao: "deletar_turma", params: { nome: delTurma[1].trim() } }
  }

  const delProf = c.match(/delet[aei]r?|remover|apag[aei]r?\s+(?:o|a\s+)?professor\s+(.+)/i)
  if (delProf) {
    return { acao: "deletar_professor", params: { nome: delProf[1].trim() } }
  }

  const delMat = c.match(/delet[aei]r?|remover|apag[aei]r?\s+(?:a\s+)?(?:materia|mat[eé]ria)\s+(.+)/i)
  if (delMat) {
    return { acao: "deletar_materia", params: { nome: delMat[1].trim() } }
  }

  const delPeriodo = c.match(/delet[aei]r?|remover|apag[aei]r?\s+(?:o|a\s+)?periodo\s+(.+)/i)
  if (delPeriodo) {
    return { acao: "deletar_periodo", params: { nome: delPeriodo[1].trim() } }
  }

  // editar
  const editProf = c.match(/edit[aei]r?|atualiz[aei]r?|alter[aei]r?\s+(?:o|a\s+)?professor\s+(.+)/i)
  if (editProf) {
    return { acao: "editar_professor", params: { busca: editProf[1].trim() } }
  }

  const editTurma = c.match(/edit[aei]r?|atualiz[aei]r?|alter[aei]r?\s+(?:a\s+)?(?:turma|sala|classe)\s+(.+)/i)
  if (editTurma) {
    return { acao: "editar_turma", params: { busca: editTurma[1].trim() } }
  }

  const editMat = c.match(/edit[aei]r?|atualiz[aei]r?|alter[aei]r?\s+(?:a\s+)?(?:materia|mat[eé]ria)\s+(.+)/i)
  if (editMat) {
    return { acao: "editar_materia", params: { busca: editMat[1].trim() } }
  }

  const editPeriodo = c.match(/edit[aei]r?|atualiz[aei]r?|alter[aei]r?\s+(?:o|a\s+)?periodo\s+(.+)/i)
  if (editPeriodo) {
    return { acao: "editar_periodo", params: { busca: editPeriodo[1].trim() } }
  }

  // mudar campo especifico: "mude o email do NOME para VALOR"
  const mudarEmail = c.match(/(?:mud[aei]r?|troc[aei]r?|alter[aei]r?)\s+o\s+email\s+(?:do|da|de)\s+(.+?)\s+para\s+(.+)/i)
  if (mudarEmail) {
    return { acao: "editar_professor", params: { busca: mudarEmail[1].trim(), email: mudarEmail[2].trim() } }
  }

  const mudarTel = c.match(/(?:mud[aei]r?|troc[aei]r?|alter[aei]r?)\s+o\s+telefone\s+(?:do|da|de)\s+(.+?)\s+para\s+(.+)/i)
  if (mudarTel) {
    return { acao: "editar_professor", params: { busca: mudarTel[1].trim(), telefone: mudarTel[2].trim() } }
  }

  // detalhes
  const detalhesProf = c.match(/detalhes?\s+(?:do|da|de\s+)?professor\s+(.+)/i)
  if (detalhesProf) {
    return { acao: "detalhes_professor", params: { nome: detalhesProf[1].trim() } }
  }

  // gerar grade / recreio
  if (/ger[ae]r?\s+(?:grade|hor[aá]rio)/i.test(c)) {
    return { acao: "gerar_grade", params: {} }
  }
  if (/ger[ae]r?\s+recreio/i.test(c)) {
    return { acao: "gerar_recreio", params: {} }
  }

  // planejamento
  const criarPlan = c.match(/cri[ae]r?\s+(?:um\s+)?planejamento\s+(?:para\s+)?(.+)/i)
  if (criarPlan) {
    return { acao: "criar_planejamento", params: { descricao: criarPlan[1].trim() } }
  }

  // series
  const criarSerie = c.match(/cri[ae]r?\s+(?:uma\s+)?s[eé]rie\s+(.+)/i)
  if (criarSerie) {
    return { acao: "criar_serie", params: { nome: criarSerie[1].trim() } }
  }

  // status professor
  const statusProf = c.match(/(?:coloc[aei]r?|deix[aei]r?|mud[aei]r?)\s+(?:o\s+)?(\w[\w\s]+?)\s+como\s+(presente|ausente|f[eé]rias|licen[cç]a|atestado)/i)
  if (statusProf) {
    return { acao: "alterar_status_professor", params: { nome: statusProf[1].trim(), status: statusProf[2].trim() } }
  }

  // disponiveis
  if (/dispon[ií]veis|presentes|quem\s+est[aá]/i.test(c)) {
    return { acao: "listar_disponiveis", params: {} }
  }

  // limpar grade
  if (/limpar|apagar\s+(?:a\s+)?grade/i.test(c)) {
    return { acao: "limpar_grade", params: {} }
  }

  // conflitos
  if (/conflitos?|conflit[oa]s?\s+grade/i.test(c)) {
    return { acao: "verificar_conflitos", params: {} }
  }

  // resumo semanal
  if (/resumo\s+semanal|semana|relat[oó]rio/.test(c)) {
    return { acao: "resumo_semanal", params: {} }
  }

  return null
}

// ===== FERRAMENTAS DISPONIVEIS =====
const FERRAMENTAS = [
  // TURMAS
  "criar_turma", "editar_turma", "deletar_turma", "listar_turmas", "turmas_sem_professor",
  // PROFESSORES
  "criar_professor", "editar_professor", "deletar_professor", "listar_professores",
  "detalhes_professor", "alterar_status_professor", "listar_disponiveis",
  "professores_por_especialidade",
  // MATERIAS
  "criar_materia", "editar_materia", "deletar_materia", "listar_materias",
  // SERIES
  "criar_serie", "editar_serie", "deletar_serie", "listar_series",
  // PERIODOS
  "criar_periodo", "editar_periodo", "deletar_periodo", "listar_periodos",
  // FALTAS
  "registrar_falta", "deletar_falta", "justificar_falta",
  "listar_faltas", "faltas_do_professor", "professor_mais_faltas",
  // SUBSTITUICOES
  "listar_substituicoes", "sugerir_substituto",
  "confirmar_substituicao", "recusar_substituicao", "cancelar_substituicao",
  // PLANEJAMENTO
  "criar_planejamento", "editar_planejamento", "deletar_planejamento", "listar_planejamentos",
  // GRADE
  "gerar_grade", "limpar_grade", "listar_grade_turma", "verificar_conflitos",
  "adicionar_aula", "remover_aula",
  // RECREIO
  "gerar_recreio",
  // EVENTOS
  "listar_eventos",
  // CONSULTAS
  "resumo_semanal",
  "status_sistema",
]

// ===== ROTA PRINCIPAL - SO INTERPRETA, NAO EXECUTA =====
export async function POST(request: Request) {
  try {
    const { comando } = await request.json()
    if (!comando) {
      return NextResponse.json({ error: "Comando vazio" }, { status: 400 })
    }

    let decisao: any = null

    // Tenta IA primeiro (com fallback de modelos)
    const modelosFallback = [
      process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
      "openrouter/free",
      "mistralai/mistral-nemo",
    ]

    for (const modelo of modelosFallback) {
      try {
        const systemPrompt = `Voce e o assistente de direcao escolar.
Com base no comando, decida qual acao executar.
Retorne APENAS JSON: { "acao": "nome", "params": { ... } }
Acoes: ${FERRAMENTAS.join(", ")}`

        const content = await chamarIA([
          { role: "system", content: systemPrompt },
          { role: "user", content: comando },
        ], { temperature: 0.1 }, modelo)

        decisao = JSON.parse(content.replace(/```json|```|```/g, "").trim())
        if (FERRAMENTAS.includes(decisao?.acao)) break
        decisao = null
      } catch (_) {
        decisao = null
      }
      if (decisao) break
    }

    // Fallback: parser simples
    if (!decisao) {
      decisao = parseComandoSimples(comando)
    }

    if (!decisao) {
      return NextResponse.json({
        resposta: `Nao entendi. Tente:\n- "crie uma turma NOME"\n- "FULANO faltou"\n- "liste professores"`,
        acao: "desconhecido",
      })
    }

    // Retorna APENAS a decisao - quem executa e o cliente
    return NextResponse.json({
      acao: decisao.acao,
      params: decisao.params,
      sucesso: true,
      mensagem: `Entendi! Vou ${decisao.acao.replace(/_/g, " ")}.`,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro"
    return NextResponse.json({ resposta: `Erro: ${message}`, acao: "erro" })
  }
}
