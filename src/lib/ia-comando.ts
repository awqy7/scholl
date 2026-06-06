import { getConfigTipo, normalizarTipoEscola } from "@/lib/escola-tipo"

// Apenas ações de análise e sugestão (modo advisor).
// As ações antigas de mutação (criar/editar/deletar/gerar) ainda existem em rotas legadas,
// mas o chat NÃO deve mais anunciá-las nem executá-las.
export const FERRAMENTAS = [
  // Advisor (current focus for chat and practicality)
  "analisar_escola",
  "sugerir_melhorias",
  "relatorio_professor",
  "prever_faltas",
  "responder_pergunta",
  "status_sistema",
  "listar_professores",
  "listar_turmas",
  "listar_materias",
  "listar_periodos",
  "listar_series",
  "listar_disponiveis",
  "professores_por_especialidade",
  "resumo_semanal",

  // Legacy (for API compatibility and manual grade/recreio features - chat guard + prompt prevent use)
  "criar_turma", "editar_turma", "deletar_turma", "listar_turmas", "turmas_sem_professor",
  "criar_professor", "editar_professor", "deletar_professor", "listar_professores",
  "detalhes_professor", "alterar_status_professor", "listar_disponiveis", "professores_por_especialidade",
  "criar_materia", "editar_materia", "deletar_materia", "listar_materias",
  "criar_serie", "editar_serie", "deletar_serie", "listar_series",
  "criar_periodo", "editar_periodo", "deletar_periodo", "listar_periodos",
  "registrar_falta", "deletar_falta", "justificar_falta", "listar_faltas",
  "faltas_do_professor", "professor_mais_faltas",
  "listar_substituicoes", "sugerir_substituto", "confirmar_substituicao",
  "recusar_substituicao", "cancelar_substituicao",
  "criar_planejamento", "editar_planejamento", "deletar_planejamento", "listar_planejamentos",
  "gerar_grade", "montar_escola_completa", "gerar_tudo", "limpar_grade", "listar_grade_turma", "verificar_conflitos",
  "adicionar_aula", "remover_aula",
  "gerar_recreio",
  "listar_eventos", "resumo_semanal", "status_sistema",
] as const

export type AcaoComando = (typeof FERRAMENTAS)[number]

export interface DecisaoComando {
  acao: AcaoComando | "desconhecido" | "erro"
  params: Record<string, unknown>
  confianca?: number
  explicacao?: string
}

export function buildSystemPrompt(contexto?: {
  tipoEscola?: string
  professores?: number
  turmas?: number
  materias?: number
  nomesProfessores?: string[]
  horaAtual?: string
}): string {
  const tipo = normalizarTipoEscola(contexto?.tipoEscola)
  const cfg = getConfigTipo(tipo)
  const listaProf =
    contexto?.nomesProfessores?.length
      ? ` Nomes no banco: ${contexto.nomesProfessores.slice(0, 25).join(", ")}${contexto.nomesProfessores.length > 25 ? "…" : ""}.`
      : ""
  const ctx = contexto
    ? `\nContexto atual (dados REAIS do Supabase): Tipo **${cfg.label}** (${tipo}). ${contexto.professores ?? "?"} professores, ${contexto.turmas ?? "?"} ${cfg.recursos.rotuloTurmas.toLowerCase()}, ${contexto.materias ?? "?"} matérias.${listaProf} Hora: ${contexto.horaAtual ?? "?"}.`
    : `\nTipo de escola: **${cfg.label}** (${tipo}).`

  const acoesBloqueadas =
    tipo === "normal"
      ? "\n- PROIBIDO nesta escola: gerar_recreio (recreio intercalado é só para creche)."
      : ""

  return `Você é ARIA, a assistente inteligente de gestão escolar.
Seu papel é **somente advisor**. Respostas SEMPRE CURTAS e INSTRUTIVAS (bullets diretos, no máximo 4-5 linhas). Foque em "faça isso na página X agora".
- NUNCA proponha cadastros, edições ou geração automática.
- Sempre diga exatamente qual página o usuário deve usar para a ação.

Responda SEMPRE de forma CURTA, DIRETA e INSTRUTIVA (máx. 4-5 linhas ou bullets curtos). Foque em ações concretas que o usuário deve fazer agora nas páginas do sistema. Evite texto longo, explicações desnecessárias ou repetições. Use bullets para passos. Seja útil e preciso.${ctx}

${cfg.promptModuloIA}${acoesBloqueadas}

RETORNE APENAS JSON VÁLIDO (apenas ações de análise):
{ "acao": "nome_da_acao", "params": { ... }, "confianca": 0-100, "explicacao": "breve justificativa" }

AÇÕES DISPONÍVEIS (somente advisor):
${FERRAMENTAS.join(", ")}

REGRAS CRÍTICAS (modo advisor):
- Você NÃO pode criar, editar, deletar ou gerar nada.
- Use "analisar_escola", "sugerir_melhorias", "relatorio_professor", "prever_faltas", "responder_pergunta", "status_sistema", "resumo_semanal" e os "listar_*".
- Se o usuário pedir para cadastrar, gerar grade, registrar falta, etc., responda com "responder_pergunta" explicando que ele deve fazer manualmente nas páginas e ofereça análise do estado atual.
- "responder_pergunta" é para dúvidas ou quando a ação não é uma das listadas acima.

EXEMPLOS DE USO CORRETO (advisor):
- "analise a escola" → analisar_escola {}
- "dê sugestões de melhoria" → sugerir_melhorias {}
- "relatório do professor João" → relatorio_professor { nome: "João" }
- "prever faltas" → prever_faltas {}
- "qual o status hoje?" → status_sistema {}
- "resumo da semana" → resumo_semanal {}
- "o que é recreio intercalado?" → responder_pergunta { pergunta: "o que é recreio intercalado?" }

NUNCA gere JSON com "criar_professor", "gerar_grade", "registrar_falta" etc. Esses comandos não existem mais no modo atual do chat.
- "crie matérias Matemática, Português, Ciências e Artes" → criar_materia { nomes: ["Matemática", "Português", "Ciências", "Artes"] }
- "maria silva faltou por atestado" → registrar_falta { professor_nome: "Maria Silva", motivo: "atestado médico" }
- "monta a grade" → gerar_grade {}
- "gere tudo salas professores e grade" (creche) → montar_escola_completa { gerar_grade: true, gerar_recreio: true }
- "gere tudo salas professores e grade" (normal) → montar_escola_completa { gerar_grade: true, gerar_recreio: false }
- "organize o recreio intercalado" (só creche) → gerar_recreio {}
- "monte a escola completa" → montar_escola_completa {}
- "analisa minha escola" → analisar_escola {}
- "quem pode substituir a Ana?" → sugerir_substituto { professor_nome: "Ana" }
- "como está a escola hoje?" → status_sistema {}
- "quantos professores tenho?" → listar_professores {}
- "exclua o professor Ana Silva" → deletar_professor { nome: "Ana Silva" }
- "apague todos os professores" → deletar_professor { todos: true }
- qualquer pergunta geral → responder_pergunta { pergunta: "..." }

IMPORTANTE: Pedidos de criação/alteração SEMPRE viram ação executável (criar_*, editar_*, deletar_*, etc.), nunca "responder_pergunta".`
}

const PALAVRAS_NUMERO: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
}

export function parseQuantidade(texto?: string): number {
  if (!texto) return 1
  const t = texto.toLowerCase().trim()
  if (/^\d+$/.test(t)) return Math.min(Math.max(parseInt(t, 10), 1), 20)
  return PALAVRAS_NUMERO[t] || 1
}

export function isComandoMutacao(comando: string): boolean {
  const c = comando.toLowerCase().trim()
  if (/^(como|o que|oque|qual|quais|quantos|por que|porque|onde|quando|pode|poderia|seria)\b/.test(c)) {
    return false
  }
  if (/\?\s*$/.test(c)) return false
  return /cri[ae]|cadastr|adicion|novo|nova|delet|remov|apag|exclu|edit|atualiz|alter|mudar|trocar|registr|faltou|n[aã]o\s+veio|esta\s+ausente|ger[ae]r|mont|limpar|confirmar|recusar|cancelar|substitu|marcar|colocar|deixar|liste|listar|mostre|mostrar|apague|exclua/i.test(c)
}

export function capitalizarNome(texto: string): string {
  return texto
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ")
}

/** Separa lista em texto: vírgula, " e ", ";", quebra de linha */
export function splitListaNomes(texto: string): string[] {
  if (!texto?.trim()) return []
  return texto
    .split(/\s*,\s*|\s+;\s+|\s+e\s+|\n+/)
    .map((p) => capitalizarNome(p.replace(/^[\d.\-\)]\s*/, "").trim()))
    .filter((n) => n.length > 1 && !/^(professores?|turmas?|salas?|mat[eé]rias?)$/i.test(n))
}

export interface ItemProfessorCadastro {
  nome: string
  email?: string
  telefone?: string
  especialidades?: string[]
  carga_horaria?: number
}

/** Extrai nomes do comando natural quando a IA enviou params incompletos */
export function extrairNomesDoComando(
  comando: string,
  tipo: "professor" | "materia" | "turma" | "serie"
): string[] {
  const c = comando.trim()
  const rotulos: Record<string, RegExp[]> = {
    professor: [
      /(?:cri[ae]|cadastr[ae]|adicion[ae]|registr[ae]|inclu[ae]|mont[ae]|coloc[ae])\s+(?:\d+\s+)?professores?(?:\s+com)?\s+(?:os\s+)?nomes?\s+(.+)$/i,
      /professores?\s*(?:com\s+)?(?:os\s+)?nomes?\s+(.+)$/i,
      /professores?\s*[:\-]\s*(.+)$/i,
      /(?:cri[ae]|cadastr[ae]).{0,20}professores?\s+(.+)$/i,
    ],
    materia: [
      /(?:cri[ae]|cadastr[ae]).{0,20}(?:mat[eé]rias?|disciplinas?)\s+(.+)$/i,
      /(?:mat[eé]rias?|disciplinas?)\s*[:\-]\s*(.+)$/i,
    ],
    turma: [
      /(?:cri[ae]|cadastr[ae]).{0,20}(?:turmas?|salas?)\s+(.+)$/i,
      /(?:turmas?|salas?)\s*[:\-]\s*(.+)$/i,
    ],
    serie: [/(?:cri[ae]|cadastr[ae]).{0,15}s[eé]ries?\s+(.+)$/i],
  }

  for (const re of rotulos[tipo] || []) {
    const m = c.match(re)
    if (m?.[1]) {
      const lista = splitListaNomes(m[1])
      if (lista.length) return lista
    }
  }

  const depoisDeComNomes = c.match(/\bcom\s+(?:os\s+)?nomes?\s+(.+)$/i)
  if (depoisDeComNomes?.[1]) {
    const lista = splitListaNomes(depoisDeComNomes[1])
    if (lista.length) return lista
  }

  return []
}

export function resolverProfessoresParaCadastro(
  params: Record<string, unknown>,
  comandoOriginal?: string
): ItemProfessorCadastro[] {
  const espGlobal = Array.isArray(params.especialidades)
    ? (params.especialidades as string[]).map(String)
    : params.especialidade
      ? [String(params.especialidade)]
      : []

  if (Array.isArray(params.professores)) {
    return (params.professores as Record<string, unknown>[])
      .map((p) => ({
        nome: capitalizarNome(String(p.nome || p.name || "")),
        email: p.email ? String(p.email) : undefined,
        telefone: p.telefone ? String(p.telefone) : undefined,
        especialidades: Array.isArray(p.especialidades)
          ? (p.especialidades as string[]).map(String)
          : espGlobal,
        carga_horaria: Number(p.carga_horaria) || Number(params.carga_horaria) || 20,
      }))
      .filter((p) => p.nome.length > 1)
  }

  let nomes: string[] = []
  if (Array.isArray(params.nomes)) {
    nomes = (params.nomes as unknown[]).flatMap((n) =>
      typeof n === "string" && n.includes(",") ? splitListaNomes(n) : [capitalizarNome(String(n))]
    )
  } else if (typeof params.nomes === "string") {
    nomes = splitListaNomes(params.nomes)
  } else if (typeof params.nome === "string") {
    nomes =
      params.nome.includes(",") || /\s+e\s+/i.test(params.nome)
        ? splitListaNomes(params.nome)
        : [capitalizarNome(params.nome)]
  } else if (typeof params.lista === "string") {
    nomes = splitListaNomes(params.lista)
  }

  if (!nomes.length && Number(params.quantidade) > 1 && params.base_nome) {
    const qtd = Math.min(Number(params.quantidade), 30)
    nomes = Array.from({ length: qtd }, (_, i) =>
      capitalizarNome(`${params.base_nome} ${i + 1}`)
    )
  }

  if (!nomes.length && comandoOriginal) {
    nomes = extrairNomesDoComando(comandoOriginal, "professor")
  }

  return nomes.map((nome) => ({
    nome,
    email: params.email ? String(params.email) : undefined,
    telefone: params.telefone ? String(params.telefone) : undefined,
    especialidades: espGlobal,
    carga_horaria: Number(params.carga_horaria) || 20,
  }))
}

export function resolverListaNomesCadastro(
  params: Record<string, unknown>,
  comandoOriginal: string | undefined,
  tipo: "materia" | "turma" | "serie"
): string[] {
  if (Array.isArray(params.nomes)) {
    return (params.nomes as unknown[]).flatMap((n) =>
      typeof n === "string" && n.includes(",") ? splitListaNomes(n) : [capitalizarNome(String(n))]
    )
  }
  if (typeof params.nomes === "string") return splitListaNomes(params.nomes)
  if (typeof params.nome === "string") {
    if (params.nome.includes(",") || /\s+e\s+/i.test(params.nome)) {
      return splitListaNomes(params.nome)
    }
    return [capitalizarNome(params.nome)]
  }
  if (tipo === "turma") {
    const turmas = gerarNomesTurmas(params as Parameters<typeof gerarNomesTurmas>[0])
    if (turmas.length) return turmas
  }
  if (comandoOriginal) {
    const extra = extrairNomesDoComando(comandoOriginal, tipo)
    if (extra.length) return extra
  }
  return []
}

/** Ajusta params após interpretação da IA + texto original do diretor */
export function normalizarParamsComando(
  acao: string,
  params: Record<string, unknown>,
  comandoOriginal?: string
): Record<string, unknown> {
  const cmd = comandoOriginal?.trim()
  if (acao === "criar_professor") {
    const professores = resolverProfessoresParaCadastro(params, cmd)
    if (professores.length) {
      return {
        ...params,
        professores,
        nomes: professores.map((p) => p.nome),
        quantidade: professores.length,
      }
    }
  }
  if (acao === "criar_materia") {
    const nomes = resolverListaNomesCadastro(params, cmd, "materia")
    if (nomes.length) return { ...params, nomes, quantidade: nomes.length }
  }
  if (acao === "criar_turma") {
    const nomes = resolverListaNomesCadastro(params, cmd, "turma")
    if (nomes.length) return { ...params, nomes, quantidade: nomes.length }
  }
  if (acao === "criar_serie") {
    const nomes = resolverListaNomesCadastro(params, cmd, "serie")
    if (nomes.length) return { ...params, nomes, quantidade: nomes.length }
  }
  if (acao === "deletar_professor" && cmd) {
    const todos = pedidoExcluirTodos(cmd, params)
    const nome =
      (typeof params.nome === "string" && params.nome.trim()) ||
      (typeof params.busca === "string" && params.busca.trim()) ||
      extrairNomeAlvoComando(cmd, "professor") ||
      undefined
    if (todos) return { ...params, todos: true }
    if (nome && !/^todos$/i.test(nome)) return { ...params, nome: capitalizarNome(nome) }
  }
  if (acao === "deletar_turma" && cmd) {
    const nome =
      (typeof params.nome === "string" && params.nome) ||
      extrairNomeAlvoComando(cmd, "turma")
    if (pedidoExcluirTodos(cmd, params)) return { ...params, todos: true }
    if (nome) return { ...params, nome: capitalizarNome(nome) }
  }
  if (acao === "deletar_materia" && cmd) {
    const nome =
      (typeof params.nome === "string" && params.nome) ||
      extrairNomeAlvoComando(cmd, "materia")
    if (pedidoExcluirTodos(cmd, params)) return { ...params, todos: true }
    if (nome) return { ...params, nome: capitalizarNome(nome) }
  }
  return params
}

function gerarNomesTurmas(params: {
  nome?: string
  base_nome?: string
  serie_nome?: string
  quantidade?: number
  nomes?: string[]
}): string[] {
  if (params.nomes?.length) {
    return params.nomes.map((n) => capitalizarNome(String(n)))
  }
  const qtd = Math.min(Math.max(Number(params.quantidade) || 1, 1), 20)
  if (qtd === 1 && params.nome) {
    return [capitalizarNome(String(params.nome))]
  }
  const base = capitalizarNome(
    String(params.base_nome || params.serie_nome || params.nome || "Turma")
  )
  const existentes = /^.+\s+[A-Z]$/i.test(base) || /\s+\d+$/.test(base)
  if (qtd === 1) return [base]
  if (existentes && !/\d+$/.test(base)) {
    return Array.from({ length: qtd }, (_, i) =>
      `${base} ${String.fromCharCode(65 + i)}`
    )
  }
  return Array.from({ length: qtd }, (_, i) => `${base} ${i + 1}`)
}

export { gerarNomesTurmas }

/** Sinônimos que a IA costuma gerar em português → ação canônica do sistema */
const ALIASES_ACAO: Record<string, AcaoComando> = {
  excluir_professor: "deletar_professor",
  remover_professor: "deletar_professor",
  apagar_professor: "deletar_professor",
  excluir_turma: "deletar_turma",
  remover_turma: "deletar_turma",
  excluir_materia: "deletar_materia",
  remover_materia: "deletar_materia",
  excluir_serie: "deletar_serie",
  excluir_periodo: "deletar_periodo",
  excluir_falta: "deletar_falta",
  excluir_planejamento: "deletar_planejamento",
  listar_professor: "listar_professores",
  listar_turma: "listar_turmas",
  listar_materia: "listar_materias",
}

export function normalizarAcaoComando(acao?: string): string | undefined {
  if (!acao?.trim()) return acao
  const key = acao.trim().toLowerCase().replace(/\s+/g, "_")
  return ALIASES_ACAO[key] || key
}

export function isAcaoValida(acao: string): acao is AcaoComando {
  const canon = normalizarAcaoComando(acao) || acao
  return (FERRAMENTAS as readonly string[]).includes(canon)
}

/** Extrai nome alvo de exclusão/edição do texto do diretor */
export function extrairNomeAlvoComando(
  comando: string,
  entidade: "professor" | "turma" | "materia" | "serie"
): string | null {
  const c = comando.trim()
  const rotulos: Record<string, RegExp[]> = {
    professor: [
      /(?:exclu|delet|remov|apag)[a-záéíóúãõç]*\s+(?:o\s+|a\s+)?(?:professor(?:a)?\s+)?(.+)$/i,
      /(?:professor(?:a)?)\s+(.+?)(?:\s+do\s+sistema)?$/i,
    ],
    turma: [
      /(?:exclu|delet|remov|apag)[a-záéíóúãõç]*\s+(?:a\s+)?(?:turma|sala)\s+(.+)$/i,
      /(?:turma|sala)\s+(.+)$/i,
    ],
    materia: [
      /(?:exclu|delet|remov|apag)[a-záéíóúãõç]*\s+(?:a\s+)?(?:mat[eé]ria|disciplina)\s+(.+)$/i,
    ],
    serie: [/(?:exclu|delet|remov|apag)[a-záéíóúãõç]*\s+(?:a\s+)?s[eé]rie\s+(.+)$/i],
  }

  for (const re of rotulos[entidade] || []) {
    const m = c.match(re)
    if (m?.[1]) {
      let nome = m[1].trim()
      nome = nome.replace(/\s+(?:do\s+sistema|por\s+favor|agora|já)\s*$/i, "").trim()
      if (/^todos(?:\s+os)?(?:\s+(?:professores?|turmas?|mat[eé]rias?))?$/i.test(nome)) {
        return null
      }
      if (nome.length > 1) return capitalizarNome(nome)
    }
  }
  return null
}

export function pedidoExcluirTodos(comando?: string, params?: Record<string, unknown>): boolean {
  if (params?.todos === true || params?.todos_os === true) return true
  const nome = String(params?.nome || params?.busca || "").toLowerCase()
  if (nome === "todos" || nome === "todos os professores") return true
  if (!comando) return false
  return /\b(?:todos|todas)\b/i.test(comando) &&
    /\b(?:exclu|delet|remov|apag)/i.test(comando)
}

/** Sugestões proativas da ARIA (focadas em análise, dicas e visão — alterações são feitas manualmente pelo diretor/secretaria nas páginas) */
export const SUGESTOES_RAPIDAS = [
  "🎯 Analise minha escola agora",
  "🌟 Me dá sugestões de melhorias práticas",
  "🔮 Prever faltas da próxima semana",
  "📊 Qual o status geral hoje?",
  "👥 Quais professores estão disponíveis?",
  "📋 Gere um relatório da professora Maria",
  "❓ Como está a frequência geral?",
  "💡 O que posso melhorar na minha gestão?",
]