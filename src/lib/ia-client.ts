import { extractJsonArray, parseIaJsonContent } from "./ia-utils"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL_DEFAULT = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
const GROQ_MODELS_STATIC = [
  GROQ_MODEL_DEFAULT,
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]

function resolveProvider(): "groq" | "openrouter" {
  const pref = process.env.NEXT_PUBLIC_IA_PROVIDER?.toLowerCase()
  if (pref === "groq" || pref === "openrouter") return pref
  return getGroqApiKey() ? "groq" : "openrouter"
}

const PROVIDER = resolveProvider()

function getGroqModels(): string[] {
  const env = process.env.GROQ_MODELS?.split(",").map((m) => m.trim()).filter(Boolean)
  return [...new Set([lastWorkingGroqModel, ...(env || []), ...GROQ_MODELS_STATIC].filter(Boolean) as string[])]
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free"

const MAX_MESSAGE_CHARS = 90_000
const REQUEST_TIMEOUT_MS = 55_000
const MAX_RETRIES_PER_MODEL = 4
const MODEL_BLOCK_MS = 20 * 60_000
const DYNAMIC_MODELS_TTL_MS = 6 * 60 * 60_000
const RESPONSE_CACHE_TTL = 45_000

/** Modelos free estáveis no OpenRouter (jun/2026) — ordem de prioridade */
const OPENROUTER_MODELS_STATIC = [
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "qwen/qwen3-4b:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-2-9b-it:free",
  "microsoft/phi-3.5-mini-128k-instruct:free",
  "deepseek/deepseek-r1-distill-llama-70b:free",
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const modelBlocklist = new Map<string, number>()
let lastWorkingGroqModel: string | null = null
let lastWorkingOrModel: string | null = null
let dynamicModelsCache: { models: string[]; ts: number } | null = null

const responseCache = new Map<string, { data: string; ts: number }>()

export interface IaMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface IaConfig {
  temperature?: number
  response_format?: { type: "json_object" }
  max_tokens?: number
  stream?: boolean
}

export function getGroqApiKey(): string | undefined {
  const groq = process.env.GROQ_API_KEY?.trim() || process.env.IA_GROQ_API_KEY?.trim()
  if (groq) return groq
  const ia = process.env.IA_API_KEY?.trim()
  if (ia?.startsWith("gsk_")) return ia
  return undefined
}

function getOpenRouterApiKey(): string | undefined {
  const orKey = process.env.OPENROUTER_API_KEY?.trim()
  if (orKey) return orKey
  const ia = process.env.IA_API_KEY?.trim()
  if (ia?.startsWith("sk-or-")) return ia
  return undefined
}

export function getProvedorAtivo(): "groq" | "openrouter" {
  return PROVIDER
}

function parseEnvModelList(): string[] {
  const raw = process.env.OPENROUTER_MODELS?.trim()
  if (!raw) return []
  return raw.split(",").map((m) => m.trim()).filter(Boolean)
}

function isModelBlocked(model: string): boolean {
  const until = modelBlocklist.get(model)
  if (!until) return false
  if (Date.now() > until) {
    modelBlocklist.delete(model)
    return false
  }
  return true
}

function blockModel(model: string, ms = MODEL_BLOCK_MS) {
  modelBlocklist.set(model, Date.now() + ms)
}

function rememberWorkingModel(model: string, provider: ProviderKind) {
  if (provider === "groq") lastWorkingGroqModel = model
  else lastWorkingOrModel = model
}

function backoffMs(attempt: number, rateLimited = false): number {
  const base = rateLimited ? 1200 : 400
  const exp = Math.min(attempt, 5)
  const jitter = Math.floor(Math.random() * 250)
  return base * 2 ** exp + jitter
}

function getCacheKey(messages: IaMessage[], config: IaConfig, model: string): string {
  return JSON.stringify({ model, messages: messages.slice(-4), config })
}

function trimMessages(messages: IaMessage[]): IaMessage[] {
  const total = messages.reduce((n, m) => n + m.content.length, 0)
  if (total <= MAX_MESSAGE_CHARS) return messages

  const trimmed = messages.map((m) => ({ ...m }))
  let excess = total - MAX_MESSAGE_CHARS

  for (let i = trimmed.length - 1; i >= 0 && excess > 0; i--) {
    if (trimmed[i].role !== "user") continue
    const content = trimmed[i].content
    if (content.length <= 2000) continue
    const keep = Math.max(2000, content.length - excess)
    trimmed[i] = {
      ...trimmed[i],
      content:
        content.slice(0, keep) +
        "\n\n[... dados truncados para caber no limite da IA — use apenas os IDs visíveis]",
    }
    excess -= content.length - keep
  }

  return trimmed
}

function isModelDeadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes("404") ||
    msg.includes("No endpoints found") ||
    msg.includes("not a valid model") ||
    msg.includes("model_not_found") ||
    msg.includes("does not exist") ||
    msg.includes("invalid model") ||
    msg.includes("decommissioned") ||
    msg.includes("no longer supported")
  )
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("429") || msg.includes("rate") || msg.includes("quota")
}

function isRetryableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (isModelDeadError(err)) return false
  return (
    isRateLimitError(err) ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504") ||
    msg.includes("529") ||
    msg.includes("abort") ||
    msg.includes("timeout") ||
    msg.includes("ECONNRESET") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  )
}

function isInvalidJsonError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.includes("JSON inválido") || msg.includes("JSON invalido")
}

/** Busca modelos free ativos na API do OpenRouter (cache 6h) */
async function fetchOpenRouterFreeModels(): Promise<string[]> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) return []

  if (dynamicModelsCache && Date.now() - dynamicModelsCache.ts < DYNAMIC_MODELS_TTL_MS) {
    return dynamicModelsCache.models
  }

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return []

    const body = (await res.json()) as {
      data?: Array<{
        id?: string
        pricing?: { prompt?: string; completion?: string }
      }>
    }

    const free = (body.data || [])
      .filter((m) => {
        const id = m.id || ""
        if (!id || isModelBlocked(id)) return false
        const prompt = m.pricing?.prompt
        const completion = m.pricing?.completion
        return (
          prompt === "0" ||
          completion === "0" ||
          id.endsWith(":free")
        )
      })
      .map((m) => m.id as string)
      .slice(0, 24)

    if (free.length) {
      dynamicModelsCache = { models: free, ts: Date.now() }
      return free
    }
  } catch {
    // ignora — usa lista estática
  }

  return []
}

/** Ordem final de modelos: último OK → env → API free → lista estática */
export async function getOpenRouterModels(): Promise<string[]> {
  const primary = process.env.OPENROUTER_MODEL?.trim()
  const envList = parseEnvModelList()
  const dynamic = await fetchOpenRouterFreeModels()

  const ordered = [
    lastWorkingOrModel,
    primary,
    ...envList,
    ...dynamic,
    ...OPENROUTER_MODELS_STATIC,
  ].filter((m): m is string => typeof m === "string" && m.length > 0 && !isModelBlocked(m))

  return [...new Set(ordered)]
}

type ProviderKind = "openrouter" | "groq"

interface ProviderRequest {
  provider: ProviderKind
  url: string
  apiKey: string
  model: string
}

function buildGroqRequests(): ProviderRequest[] {
  const apiKey = getGroqApiKey()
  if (!apiKey) return []
  return getGroqModels().map((model) => ({
    provider: "groq",
    url: GROQ_URL,
    apiKey,
    model,
  }))
}

async function buildOpenRouterRequests(): Promise<ProviderRequest[]> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) return []
  const models = await getOpenRouterModels()
  return models.map((model) => ({
    provider: "openrouter",
    url: OPENROUTER_URL,
    apiKey,
    model,
  }))
}

async function buildAllRequests(): Promise<ProviderRequest[]> {
  const groq = buildGroqRequests()
  const openrouter = await buildOpenRouterRequests()
  // Groq primeiro (mais rápido); OpenRouter só como backup
  if (groq.length) return [...groq, ...openrouter]
  return openrouter
}

async function callProvider(
  req: ProviderRequest,
  messages: IaMessage[],
  config: IaConfig
): Promise<string> {
  const trimmed = trimMessages(messages)
  const cacheKey = getCacheKey(trimmed, config, req.model)
  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < RESPONSE_CACHE_TTL && !config.stream) {
    return cached.data
  }

  const body: Record<string, unknown> = {
    model: req.model,
    messages: trimmed,
    temperature: config.temperature ?? 0.3,
    max_tokens: config.max_tokens ?? 4096,
  }

  if (config.response_format) {
    body.response_format = config.response_format
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${req.apiKey}`,
  }

  if (req.provider === "openrouter") {
    headers["HTTP-Referer"] =
      process.env.OPENROUTER_HTTP_REFERER || "https://aria.app"
    headers["X-Title"] = process.env.OPENROUTER_APP_TITLE || "ARIA"
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(req.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`IA ${res.status} [${req.model}]: ${errText.substring(0, 400)}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content
    if (!content || !String(content).trim()) {
      throw new Error(`IA retornou conteudo vazio (${req.model})`)
    }

    const text = String(content).trim()
    responseCache.set(cacheKey, { data: text, ts: Date.now() })
    if (responseCache.size > 120) {
      const now = Date.now()
      for (const [k, v] of responseCache) {
        if (now - v.ts > RESPONSE_CACHE_TTL) responseCache.delete(k)
      }
    }

    rememberWorkingModel(req.model, req.provider)
    return text
  } finally {
    clearTimeout(timeout)
  }
}

async function tryRequest(
  req: ProviderRequest,
  messages: IaMessage[],
  config: IaConfig
): Promise<string> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES_PER_MODEL; attempt++) {
    try {
      return await callProvider(req, messages, config)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))

      if (isModelDeadError(e)) {
        blockModel(req.model)
        break
      }

      if (!isRetryableError(e) && !isInvalidJsonError(e)) {
        break
      }

      if (attempt < MAX_RETRIES_PER_MODEL - 1) {
        await sleep(backoffMs(attempt, isRateLimitError(e)))
      }
    }
  }

  throw lastError || new Error(`Falha no modelo ${req.model}`)
}

/** Tenta vários modelos/provedores — sempre IA externa */
export async function chamarIAComFallback(
  messages: IaMessage[],
  config: IaConfig = {}
): Promise<string> {
  if (!getGroqApiKey() && !getOpenRouterApiKey()) {
    throw new Error("GROQ_API_KEY não configurada")
  }

  const requests = await buildAllRequests()
  if (!requests.length) {
    throw new Error("Nenhum provedor de IA disponível (configure GROQ_API_KEY no .env.local)")
  }

  const errors: string[] = []

  for (const req of requests) {
    if (isModelBlocked(req.model)) continue
    try {
      const content = await tryRequest(req, messages, config)
      if (content?.trim()) return content
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${req.model}: ${msg.substring(0, 120)}`)
    }
  }

  throw new Error(
    `Todos os modelos de IA falharam (${errors.length} tentativas). Último: ${errors[errors.length - 1] || "desconhecido"}`
  )
}

export async function chamarIA(
  messages: IaMessage[],
  config: IaConfig = {},
  modelOverride?: string
): Promise<string> {
  if (!getGroqApiKey() && !getOpenRouterApiKey()) {
    throw new Error("GROQ_API_KEY não configurada")
  }

  if (modelOverride) {
    const isGroq =
      getGroqModels().includes(modelOverride) ||
      modelOverride.startsWith("llama") ||
      modelOverride.startsWith("gemma") ||
      modelOverride.startsWith("mixtral") ||
      PROVIDER === "groq"
    const apiKey = isGroq ? getGroqApiKey() : getOpenRouterApiKey()
    if (!apiKey) throw new Error("GROQ_API_KEY não configurada")
    return tryRequest(
      {
        provider: isGroq ? "groq" : "openrouter",
        url: isGroq ? GROQ_URL : OPENROUTER_URL,
        apiKey: apiKey!,
        model: modelOverride,
      },
      messages,
      config
    )
  }

  return chamarIAComFallback(messages, config)
}

export async function chamarIAJson(
  messages: IaMessage[],
  config: IaConfig = {}
): Promise<unknown> {
  const content = await chamarIA(messages, {
    ...config,
    response_format: { type: "json_object" },
  })
  return parseIaJsonContent(content)
}

export async function chamarIAJsonComFallback(
  messages: IaMessage[],
  config: IaConfig = {}
): Promise<unknown> {
  const requests = await buildAllRequests()
  if (!requests.length) throw new Error("GROQ_API_KEY não configurada")

  const errors: string[] = []

  for (const req of requests) {
    if (isModelBlocked(req.model)) continue

    for (const useJson of [true, false] as const) {
      try {
        const content = await tryRequest(req, messages, {
          ...config,
          response_format: useJson ? { type: "json_object" } : undefined,
        })
        return parseIaJsonContent(content)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(msg.substring(0, 100))
        if (isModelDeadError(e)) {
          blockModel(req.model)
          break
        }
      }
    }
  }

  const repairMessages: IaMessage[] = [
    ...messages,
    {
      role: "user",
      content:
        "IMPORTANTE: responda APENAS com um único objeto JSON válido em português, sem markdown, sem texto antes ou depois.",
    },
  ]

  try {
    const content = await chamarIAComFallback(repairMessages, {
      ...config,
      response_format: undefined,
      temperature: 0.1,
    })
    return parseIaJsonContent(content)
  } catch (e) {
    const repairErr = e instanceof Error ? e.message : String(e)
    throw new Error(
      `JSON da IA inválido após ${errors.length} tentativas. ${repairErr.substring(0, 200)}`
    )
  }
}

export async function chamarIAArray(
  messages: IaMessage[],
  arrayKeys: string[],
  config: IaConfig = {}
): Promise<Record<string, unknown>[]> {
  let parsed = await chamarIAJsonComFallback(messages, config)
  let arr = extractJsonArray(parsed, arrayKeys)

  if (arr.length) return arr

  const retryMessages: IaMessage[] = [
    ...messages,
    {
      role: "user",
      content: `Retorne JSON com a chave "${arrayKeys[0]}" contendo um array não vazio de objetos.`,
    },
  ]

  parsed = await chamarIAJsonComFallback(retryMessages, {
    ...config,
    temperature: 0.15,
  })
  arr = extractJsonArray(parsed, arrayKeys)

  if (!arr.length) {
    throw new Error(
      `A IA não retornou itens em [${arrayKeys.join(", ")}]. Tente novamente em alguns segundos.`
    )
  }

  return arr
}

/** Pré-carrega lista de modelos free ao subir o servidor (não bloqueia requests) */
export function aquecerModelosIA(): void {
  void fetchOpenRouterFreeModels().catch(() => {})
}

/** Diagnóstico rápido — útil para validar chave e modelos */
export async function testarConexaoIA(): Promise<{
  ok: boolean
  modelo?: string
  provedor?: string
  modelosDisponiveis: number
  erro?: string
}> {
  try {
    const modelosGroq = getGroqModels().length
    const modelosOr = (await getOpenRouterModels()).length
    const content = await chamarIAComFallback(
      [{ role: "user", content: "Responda apenas a palavra OK." }],
      { temperature: 0, max_tokens: 16 }
    )
    if (!content?.toLowerCase().includes("ok")) {
      throw new Error(`Resposta inesperada: ${content?.slice(0, 80)}`)
    }
    return {
      ok: true,
      modelo: lastWorkingGroqModel || lastWorkingOrModel || undefined,
      provedor: getGroqApiKey() ? "groq" : PROVIDER,
      modelosDisponiveis: modelosGroq + modelosOr,
    }
  } catch (e) {
    return {
      ok: false,
      modelosDisponiveis: getGroqModels().length,
      erro: e instanceof Error ? e.message : String(e),
    }
  }
}