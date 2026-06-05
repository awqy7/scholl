#!/usr/bin/env node
/**
 * Testa IA via servidor local (dev) ou direto no OpenRouter.
 * Uso: npm run test:ia
 */

import fs from "fs"
import path from "path"

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
const GROQ_MODELS = [
  process.env.GROQ_MODEL,
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
].filter(Boolean)
const OR_MODELS = [process.env.OPENROUTER_MODEL, "openai/gpt-oss-120b:free"].filter(Boolean)

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const i = t.indexOf("=")
    if (i < 1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

async function pingLocal() {
  try {
    const res = await fetch("http://localhost:3000/api/ia/ping", {
      signal: AbortSignal.timeout(120_000),
    })
    const data = await res.json()
    return { via: "localhost", status: res.status, data }
  } catch (e) {
    return { via: "localhost", error: e.message }
  }
}

async function pingGroq(apiKey, model) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: 'Responda só: {"ok":true}' }],
      max_tokens: 32,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  return { model, status: res.status, body: text.slice(0, 200) }
}

async function pingOpenRouter(apiKey, model) {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://escola-ia.netlify.app",
      "X-Title": "Escola IA Test",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: 'Responda só: {"ok":true}' }],
      max_tokens: 32,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  const text = await res.text()
  return { model, status: res.status, body: text.slice(0, 200) }
}

async function main() {
  loadEnvLocal()

  console.log("=== Teste IA ARIA ===\n")

  const local = await pingLocal()
  console.log("1) Servidor local (/api/ia/ping):")
  console.log(JSON.stringify(local, null, 2))

  const groqKey = process.env.GROQ_API_KEY || (process.env.IA_API_KEY?.startsWith("gsk_") ? process.env.IA_API_KEY : null)
  const orKey = process.env.OPENROUTER_API_KEY || process.env.IA_API_KEY

  let directOk = false

  if (groqKey) {
    console.log("\n2) Groq direto:")
    for (const model of [...new Set(GROQ_MODELS)]) {
      try {
        const r = await pingGroq(groqKey, model)
        console.log(`  ${r.status === 200 ? "OK" : "FAIL"} ${model} → ${r.status}`)
        if (r.status !== 200) console.log(`     ${r.body}`)
        if (r.status === 200) {
          directOk = true
          break
        }
      } catch (e) {
        console.log(`  FAIL ${model} → ${e.message}`)
      }
    }
  } else {
    console.log("\n2) Groq direto: GROQ_API_KEY não encontrada")
  }

  if (!directOk && orKey) {
    console.log("\n3) OpenRouter backup:")
    for (const model of [...new Set(OR_MODELS)]) {
      try {
        const r = await pingOpenRouter(orKey, model)
        console.log(`  ${r.status === 200 ? "OK" : "FAIL"} ${model} → ${r.status}`)
        if (r.status === 200) {
          directOk = true
          break
        }
      } catch (e) {
        console.log(`  FAIL ${model} → ${e.message}`)
      }
    }
  }

  const ok = local?.data?.ok === true || directOk
  process.exit(ok ? 0 : 1)
}

main()