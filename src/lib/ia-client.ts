const PROVIDER = process.env.NEXT_PUBLIC_IA_PROVIDER || "openrouter"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free"

interface IaMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface IaConfig {
  temperature?: number
  response_format?: { type: "json_object" }
}

export async function chamarIA(
  messages: IaMessage[],
  config: IaConfig = {},
  modelOverride?: string
) {
  const apiKey = process.env.IA_API_KEY
  if (!apiKey) throw new Error("IA_API_KEY não configurada")

  const isGroq = PROVIDER === "groq"
  const url = isGroq ? GROQ_URL : OPENROUTER_URL
  const model = modelOverride || (isGroq ? GROQ_MODEL : OPENROUTER_MODEL)

  const body: any = {
    model,
    messages,
    temperature: config.temperature ?? 0.3,
    max_tokens: 2000,
  }

  if (config.response_format) {
    body.response_format = config.response_format
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`IA ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const content = data.choices[0].message.content
  if (!content) throw new Error("IA retornou conteudo vazio")
  return content
}

export async function chamarIAJson(
  messages: IaMessage[],
  config: IaConfig = {}
) {
  const content = await chamarIA(messages, {
    ...config,
    response_format: { type: "json_object" },
  })
  return JSON.parse(content.replace(/```json|```/g, "").trim())
}
