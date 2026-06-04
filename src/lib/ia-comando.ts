export const FERRAMENTAS = [
  "criar_turma", "editar_turma", "deletar_turma", "listar_turmas", "turmas_sem_professor",
  "criar_professor", "editar_professor", "deletar_professor", "listar_professores",
  "detalhes_professor", "alterar_status_professor", "listar_disponiveis", "professores_por_especialidade",
  "criar_materia", "editar_materia", "deletar_materia", "listar_materias",
  "criar_serie", "editar_serie", "deletar_serie", "listar_series",
  "criar_periodo", "editar_periodo", "deletar_periodo", "listar_periodos",
  "registrar_falta", "deletar_falta", "justificar_falta", "listar_faltas", "faltas_do_professor", "professor_mais_faltas",
  "listar_substituicoes", "sugerir_substituto", "confirmar_substituicao", "recusar_substituicao", "cancelar_substituicao",
  "criar_planejamento", "editar_planejamento", "deletar_planejamento", "listar_planejamentos",
  "gerar_grade", "limpar_grade", "listar_grade_turma", "verificar_conflitos", "adicionar_aula", "remover_aula",
  "gerar_recreio",
  "listar_eventos",
  "resumo_semanal", "status_sistema",
] as const

export type AcaoComando = (typeof FERRAMENTAS)[number]

export interface DecisaoComando {
  acao: AcaoComando | "desconhecido" | "erro"
  params: Record<string, unknown>
}

export function buildSystemPrompt(): string {
  return `Voce e o assistente completo de gestao escolar. Interprete QUALQUER pedido do usuario e escolha UMA acao.
Retorne APENAS JSON valido: { "acao": "nome_da_acao", "params": { ... } }

Acoes permitidas: ${FERRAMENTAS.join(", ")}

Regras de params (use nomes em portugues quando o usuario citar nomes):
- criar_turma: { nome, periodo?: "manha"|"tarde"|"integral" }
- criar_professor: { nome, email?, telefone?, especialidades?: string[], carga_horaria? }
- criar_materia: { nome, cor? }
- criar_periodo: { nome, tipo?, hora_inicio?, hora_fim? }
- criar_serie: { nome, ordem? }
- editar_* / deletar_*: { busca ou nome } + campos a alterar
- registrar_falta: { professor_nome, motivo? }
- gerar_grade / gerar_recreio / limpar_grade: {}
- adicionar_aula: { turma_nome, materia_nome, professor_nome, dia_semana? }
- alterar_status_professor: { nome, status: "presente"|"ausente"|"ferias"|"licenca"|"atestado" }
- criar_planejamento: { descricao ou conteudo, turma_nome?, materia_nome?, professor_nome? }

Exemplos:
- "cadastra turma maternal c de manha" -> criar_turma
- "maria silva faltou por atestado" -> registrar_falta
- "monta a grade" -> gerar_grade
- "organiza o recreio" -> gerar_recreio
- "quem ta disponivel?" -> listar_disponiveis`
}

/** Parser local quando a IA externa falha */
export function parseComandoSimples(comando: string): DecisaoComando | null {
  const c = comando.toLowerCase().trim()

  if (/status|resumo|painel|geral|como\s+est[aá]/.test(c)) {
    return { acao: "status_sistema", params: {} }
  }
  if (/(?:liste?|mostre?|quais?).*professor|professores/.test(c)) {
    return { acao: "listar_professores", params: {} }
  }
  if (/(?:liste?|mostre?|quais?).*turma|turmas/.test(c)) {
    return { acao: "listar_turmas", params: {} }
  }
  if (/(?:liste?|mostre?|quais?).*mat[eé]ria|materias/.test(c)) {
    return { acao: "listar_materias", params: {} }
  }
  if (/(?:liste?|mostre?).*periodo|per[ií]odos|hor[aá]rio/.test(c)) {
    return { acao: "listar_periodos", params: {} }
  }
  if (/(?:liste?|mostre?).*s[eé]rie|series/.test(c)) {
    return { acao: "listar_series", params: {} }
  }
  if (/(?:liste?|mostre?).*falta|faltas/.test(c)) {
    return { acao: "listar_faltas", params: {} }
  }
  if (/(?:liste?|mostre?).*substitui|substituic/.test(c)) {
    return { acao: "listar_substituicoes", params: {} }
  }
  if (/(?:liste?|mostre?).*planejamento|planejamentos/.test(c)) {
    return { acao: "listar_planejamentos", params: {} }
  }
  if (/(?:liste?|mostre?).*evento|timeline/.test(c)) {
    return { acao: "listar_eventos", params: {} }
  }

  const turmaMatch = c.match(/(?:cri[ae]|cadastr|adicion|nova?).{0,12}(?:turma|sala|classe)\s+(.+)/i)
  if (turmaMatch) {
    const periodo = /tarde/.test(c) ? "tarde" : /integral/.test(c) ? "integral" : "manha"
    return { acao: "criar_turma", params: { nome: turmaMatch[1].trim(), periodo } }
  }

  const profMatch = c.match(/(?:cri[ae]|cadastr|adicion|nova?).{0,12}professor[a]?\s+(.+)/i)
  if (profMatch) {
    return { acao: "criar_professor", params: { nome: profMatch[1].trim() } }
  }

  const matMatch = c.match(/(?:cri[ae]|cadastr|adicion|nova?).{0,12}(?:materia|mat[eé]ria)\s+(.+)/i)
  if (matMatch) {
    return { acao: "criar_materia", params: { nome: matMatch[1].trim() } }
  }

  const periodoMatch = c.match(/(?:cri[ae]|cadastr|adicion|nova?).{0,12}periodo\s+(.+)/i)
  if (periodoMatch) {
    return { acao: "criar_periodo", params: { nome: periodoMatch[1].trim() } }
  }

  const serieMatch = c.match(/(?:cri[ae]|cadastr|adicion|nova?).{0,12}s[eé]rie\s+(.+)/i)
  if (serieMatch) {
    return { acao: "criar_serie", params: { nome: serieMatch[1].trim() } }
  }

  const faltaMatch = c.match(/(.+?)\s+(?:faltou|esta\s+ausente|n[aã]o\s+veio)/i)
  if (faltaMatch) {
    const motivo = c.match(/motivo[:\s]+(.+)/i)?.[1]?.trim()
    return { acao: "registrar_falta", params: { professor_nome: faltaMatch[1].trim(), motivo } }
  }

  const delTurma = c.match(/(?:deletar|remover|apagar|excluir)\s+(?:a\s+)?(?:turma|sala|classe)\s+(.+)/i)
  if (delTurma) return { acao: "deletar_turma", params: { nome: delTurma[1].trim() } }

  const delProf = c.match(/(?:deletar|remover|apagar|excluir)\s+(?:o|a\s+)?professor[a]?\s+(.+)/i)
  if (delProf) return { acao: "deletar_professor", params: { nome: delProf[1].trim() } }

  const delMat = c.match(/(?:deletar|remover|apagar|excluir)\s+(?:a\s+)?(?:materia|mat[eé]ria)\s+(.+)/i)
  if (delMat) return { acao: "deletar_materia", params: { nome: delMat[1].trim() } }

  const delPeriodo = c.match(/(?:deletar|remover|apagar|excluir)\s+(?:o|a\s+)?periodo\s+(.+)/i)
  if (delPeriodo) return { acao: "deletar_periodo", params: { nome: delPeriodo[1].trim() } }

  const delSerie = c.match(/(?:deletar|remover|apagar|excluir)\s+(?:a\s+)?s[eé]rie\s+(.+)/i)
  if (delSerie) return { acao: "deletar_serie", params: { nome: delSerie[1].trim() } }

  const editProf = c.match(/(?:editar|atualizar|alterar|mudar)\s+(?:o|a\s+)?professor[a]?\s+(.+)/i)
  if (editProf) return { acao: "editar_professor", params: { busca: editProf[1].trim() } }

  const editTurma = c.match(/(?:editar|atualizar|alterar|mudar)\s+(?:a\s+)?(?:turma|sala|classe)\s+(.+)/i)
  if (editTurma) return { acao: "editar_turma", params: { busca: editTurma[1].trim() } }

  const editMat = c.match(/(?:editar|atualizar|alterar|mudar)\s+(?:a\s+)?(?:materia|mat[eé]ria)\s+(.+)/i)
  if (editMat) return { acao: "editar_materia", params: { busca: editMat[1].trim() } }

  const mudarEmail = c.match(/(?:mudar|trocar|alterar)\s+(?:o\s+)?email\s+(?:do|da|de)\s+(.+?)\s+para\s+(.+)/i)
  if (mudarEmail) {
    return { acao: "editar_professor", params: { busca: mudarEmail[1].trim(), email: mudarEmail[2].trim() } }
  }

  const mudarTel = c.match(/(?:mudar|trocar|alterar)\s+(?:o\s+)?telefone\s+(?:do|da|de)\s+(.+?)\s+para\s+(.+)/i)
  if (mudarTel) {
    return { acao: "editar_professor", params: { busca: mudarTel[1].trim(), telefone: mudarTel[2].trim() } }
  }

  const detalhesProf = c.match(/detalhes?\s+(?:do|da|de\s+)?professor[a]?\s+(.+)/i)
  if (detalhesProf) return { acao: "detalhes_professor", params: { nome: detalhesProf[1].trim() } }

  if (/ger[ae]r?|mont[ae]r?|cri[ae]r?.{0,8}(?:grade|hor[aá]rio)/i.test(c)) {
    return { acao: "gerar_grade", params: {} }
  }
  if (/ger[ae]r?|organiz|mont[ae]r?.{0,8}recreio/i.test(c)) {
    return { acao: "gerar_recreio", params: {} }
  }
  if (/limpar|apagar\s+(?:a\s+)?grade/i.test(c)) {
    return { acao: "limpar_grade", params: {} }
  }
  if (/conflito/i.test(c)) {
    return { acao: "verificar_conflitos", params: {} }
  }

  const criarPlan = c.match(/(?:cri[ae]r?|novo)\s+planejamento\s+(?:para\s+)?(.+)/i)
  if (criarPlan) return { acao: "criar_planejamento", params: { descricao: criarPlan[1].trim() } }

  const statusProf = c.match(/(?:colocar|deixar|mudar|marcar)\s+(.+?)\s+como\s+(presente|ausente|f[eé]rias|licen[cç]a|atestado)/i)
  if (statusProf) {
    return { acao: "alterar_status_professor", params: { nome: statusProf[1].trim(), status: statusProf[2].trim() } }
  }

  if (/dispon[ií]veis|presentes|quem\s+est[aá]|quem\s+pode/.test(c)) {
    return { acao: "listar_disponiveis", params: {} }
  }
  if (/resumo\s+semanal|relat[oó]rio\s+semanal/.test(c)) {
    return { acao: "resumo_semanal", params: {} }
  }
  if (/confirmar\s+substitui/.test(c)) return { acao: "confirmar_substituicao", params: {} }
  if (/recusar\s+substitui/.test(c)) return { acao: "recusar_substituicao", params: {} }
  if (/cancelar\s+substitui/.test(c)) return { acao: "cancelar_substituicao", params: {} }
  if (/sugerir\s+substituto|quem\s+substitui/.test(c)) {
    const nome = c.match(/(?:para|de)\s+(.+)/i)?.[1]?.trim()
    return { acao: "sugerir_substituto", params: nome ? { professor_nome: nome } : {} }
  }

  return null
}

export function isAcaoValida(acao: string): acao is AcaoComando {
  return (FERRAMENTAS as readonly string[]).includes(acao)
}