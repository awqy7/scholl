import { getConfigTipo, normalizarTipoEscola } from "@/lib/escola-tipo"

export const FERRAMENTAS = [
  // Turmas
  "criar_turma", "editar_turma", "deletar_turma", "listar_turmas", "turmas_sem_professor",
  // Professores
  "criar_professor", "editar_professor", "deletar_professor", "listar_professores",
  "detalhes_professor", "alterar_status_professor", "listar_disponiveis", "professores_por_especialidade",
  // Matérias
  "criar_materia", "editar_materia", "deletar_materia", "listar_materias",
  // Séries
  "criar_serie", "editar_serie", "deletar_serie", "listar_series",
  // Períodos
  "criar_periodo", "editar_periodo", "deletar_periodo", "listar_periodos",
  // Faltas
  "registrar_falta", "deletar_falta", "justificar_falta", "listar_faltas",
  "faltas_do_professor", "professor_mais_faltas",
  // Substituições
  "listar_substituicoes", "sugerir_substituto", "confirmar_substituicao",
  "recusar_substituicao", "cancelar_substituicao",
  // Planejamento
  "criar_planejamento", "editar_planejamento", "deletar_planejamento", "listar_planejamentos",
  // Grade & setup autônomo
  "gerar_grade", "montar_escola_completa", "gerar_tudo", "limpar_grade", "listar_grade_turma", "verificar_conflitos",
  "adicionar_aula", "remover_aula",
  // Recreio
  "gerar_recreio",
  // Eventos & Stats
  "listar_eventos", "resumo_semanal", "status_sistema",
  // IA Analítica (novos)
  "analisar_escola", "sugerir_melhorias", "relatorio_professor",
  "otimizar_grade", "prever_faltas",
  // Conversação natural
  "responder_pergunta",
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

  return `Você é ARIA (Assistente de Roteamento Inteligente de Ações), o sistema de gestão escolar brasileiro.
O diretor acabou de cadastrar a escola e fala naturalmente — você INTERPRETA e EXECUTA tudo no banco (cadastros em lote, grade, faltas).
Todo pedido vira UMA ação com params completos; nunca diga "vá em Turmas" ou "cadastre manualmente".${ctx}

${cfg.promptModuloIA}${acoesBloqueadas}

RETORNE APENAS JSON VÁLIDO:
{ "acao": "nome_da_acao", "params": { ... }, "confianca": 0-100, "explicacao": "breve justificativa" }

AÇÕES DISPONÍVEIS: ${FERRAMENTAS.join(", ")}

REGRAS CRÍTICAS:
- NUNCA use "responder_pergunta" para pedidos de CRIAR, EDITAR, DELETAR, LISTAR, REGISTRAR, GERAR ou ALTERAR dados.
- "responder_pergunta" é SOMENTE para dúvidas gerais sem ação no sistema (ex.: "o que é recreio intercalado?").
- Você EXECUTA ações no banco via JSON — não oriente o usuário a fazer manualmente no sistema.
- Vários itens no mesmo pedido → UM único JSON com array "nomes" ou "professores"/"materias" (cadastro em lote).

REGRAS DE PARAMS (cadastro em lote — OBRIGATÓRIO):
- criar_professor com VÁRIOS nomes:
  { "nomes": ["Nome Completo 1", "Nome Completo 2", ...], "especialidades"?: ["Matéria"], "carga_horaria"?: number }
  OU detalhado: { "professores": [{ "nome": "...", "email"?: "...", "especialidades"?: [], "carga_horaria"?: 20 }] }
  NUNCA crie só um professor se o usuário pediu vários — extraia TODOS os nomes do texto.
- criar_turma: { nome?, quantidade?: number, base_nome?, nomes?: string[], periodo?: "manha"|"tarde"|"integral", serie_nome? }
  Ex.: "crie duas salas de maternal" → { quantidade: 2, base_nome: "Maternal", serie_nome: "Maternal", periodo: "manha" }
  Ex.: "crie turmas Maternal A, Jardim 1 B e Pré A" → { nomes: ["Maternal A", "Jardim 1 B", "Pré A"] }
- criar_materia com várias: { "nomes": ["Matemática", "Português", ...] } ou { "nome": "única" }
- criar_periodo: { nome, tipo?: "entrada"|"aula"|"recreio"|"saida", hora_inicio?, hora_fim? }
- criar_serie: { nome, ordem? }
- editar_*: { busca ou nome } + campos alterados
- deletar_*: { nome ou busca } — use SEMPRE "deletar_professor" (nunca excluir_professor)
- deletar todos: { todos: true } ou { nome: "todos" }
- registrar_falta: { professor_nome, motivo?, data? }
- gerar_grade / gerar_recreio / limpar_grade: {} (cria dados faltantes automaticamente antes de executar)
- montar_escola_completa / gerar_tudo: { gerar_grade?: true, gerar_recreio?: true } — cria séries, turmas, professores, matérias, períodos e gera grade/recreio
- adicionar_aula: { turma_nome, materia_nome, professor_nome, dia_semana?: 0-4 }
- alterar_status_professor: { nome, status: "presente"|"ausente"|"ferias"|"licenca"|"atestado" }
- criar_planejamento: { descricao, turma_nome?, materia_nome?, professor_nome? }
- sugerir_substituto: { professor_nome? }
- analisar_escola: {}
- sugerir_melhorias: {}
- relatorio_professor: { nome }
- otimizar_grade: {}
- prever_faltas: {}
- responder_pergunta: { pergunta }

EXEMPLOS:
- "crie 5 professores com nomes Ana Silva, Bruno Costa, Carla Dias, Diego Lima e Elena Moura" → criar_professor { nomes: ["Ana Silva", "Bruno Costa", "Carla Dias", "Diego Lima", "Elena Moura"] }
- "cadastre professores João Santos, Maria Oliveira e Pedro Almeida, especialidade matemática" → criar_professor { nomes: ["João Santos", "Maria Oliveira", "Pedro Almeida"], especialidades: ["Matemática"] }
- "cadastra turma maternal c de manhã" → criar_turma { nome: "Maternal C", periodo: "manha" }
- "crie duas salas de maternal" → criar_turma { quantidade: 2, base_nome: "Maternal", serie_nome: "Maternal", periodo: "manha" }
- "crie 3 turmas jardim 1 tarde" → criar_turma { quantidade: 3, base_nome: "Jardim 1", serie_nome: "Jardim 1", periodo: "tarde" }
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

/** Mensagens de sugestão proativa da IA */
export const SUGESTOES_RAPIDAS = [
  "👥 Crie 3 professores: Ana Silva, João Costa e Maria Lima",
  "🚀 Gere tudo: salas, professores e grade",
  "🏫 Crie duas salas de Maternal",
  "📊 Mostre o status geral",
  "👥 Liste todos os professores",
  "📅 Gere a grade horária",
  "🎯 Analise minha escola",
  "🔄 Organize o recreio",
  "📋 Resumo semanal",
  "⚠️ Verificar conflitos",
  "🌟 Sugerir melhorias",
]