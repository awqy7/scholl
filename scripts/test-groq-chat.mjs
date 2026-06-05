import fs from "fs"
import path from "path"

function loadEnv() {
  const file = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
}

async function groq(body) {
  const key = process.env.GROQ_API_KEY
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  return { status: res.status, text }
}

loadEnv()

console.log("=== Teste Groq (chat ARIA) ===\n")

const tests = [
  {
    name: "Texto simples",
    body: {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: "Diga apenas: ok" }],
      max_tokens: 20,
    },
  },
  {
    name: "JSON mode (como /api/ia/comando)",
    body: {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            'Retorne JSON: {"acao":"listar_professores","params":{},"confianca":90}',
        },
        { role: "user", content: "liste os professores" },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 300,
    },
  },
  {
    name: "Modelo mixtral (pode falhar)",
    body: {
      model: "mixtral-8x7b-32768",
      messages: [{ role: "user", content: "ok" }],
      max_tokens: 10,
    },
  },
]

for (const t of tests) {
  try {
    const r = await groq(t.body)
    console.log(`${r.status === 200 ? "OK" : "FAIL"} ${t.name} → ${r.status}`)
    if (r.status !== 200) console.log(r.text.slice(0, 300))
    else console.log(r.text.slice(0, 180) + "\n")
  } catch (e) {
    console.log(`FAIL ${t.name} → ${e.message}`)
  }
}