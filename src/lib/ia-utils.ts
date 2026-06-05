/** Extrai array de respostas JSON da IA (objeto wrapper ou array direto). */
export function extractJsonArray(
  payload: unknown,
  preferredKeys: string[] = ["aulas", "grade", "horarios", "recreios", "items", "data", "result", "lista"]
): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((x) => x && typeof x === "object") as Record<string, unknown>[]
  }
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>
    for (const key of preferredKeys) {
      const v = obj[key]
      if (Array.isArray(v)) {
        return v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]
      }
    }
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) {
        return v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]
      }
    }
  }
  return []
}

export function parseIaJsonContent(content: string): unknown {
  const cleaned = content
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        // ignora
      }
    }
    throw new Error(`IA retornou JSON inválido: ${cleaned.substring(0, 120)}`)
  }
}

/** Reduz payload enviado à IA (menos timeout e menos 413) */
export function compactEscolaPayload(data: {
  turmas?: unknown[]
  materias?: unknown[]
  professores?: unknown[]
  periodos?: unknown[]
  gradeAtual?: unknown[]
}) {
  const pick = (row: unknown, keys: string[]) => {
    if (!row || typeof row !== "object") return row
    const o = row as Record<string, unknown>
    return Object.fromEntries(keys.filter((k) => o[k] != null).map((k) => [k, o[k]]))
  }

  return {
    turmas: (data.turmas || []).map((t) => pick(t, ["id", "nome", "periodo", "serie_id"])),
    materias: (data.materias || []).map((m) => pick(m, ["id", "nome"])),
    professores: (data.professores || []).map((p) =>
      pick(p, ["id", "nome", "especialidades", "carga_horaria", "status"])
    ),
    periodos: (data.periodos || []).map((p) =>
      pick(p, ["id", "nome", "tipo", "ordem", "hora_inicio", "hora_fim"])
    ),
    gradeAtual: (data.gradeAtual || []).slice(0, 40).map((g) =>
      pick(g, ["turma_id", "materia_id", "professor_id", "dia_semana", "periodo_id"])
    ),
  }
}

export function formatIaError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (raw.includes("GROQ_API_KEY") || raw.includes("IA_API_KEY") || raw.includes("Nenhum provedor")) {
    return "ARIA indisponível: configure GROQ_API_KEY no .env.local e reinicie o servidor (npm run dev)."
  }
  if (raw.includes("decommissioned") || raw.includes("no longer supported")) {
    return "ARIA: modelo de IA desatualizado. Reinicie o servidor (npm run dev)."
  }
  if (raw.includes("Todos os modelos")) {
    return "A IA está instável no momento — o sistema já tentou vários modelos free. Aguarde 30s e tente de novo, ou configure OPENROUTER_MODELS com modelos ativos em openrouter.ai/models."
  }
  if (raw.includes("404") || raw.includes("No endpoints found") || raw.includes("model_not_found")) {
    return "Modelo indisponível no OpenRouter. O sistema tentará outros automaticamente; se persistir, atualize OPENROUTER_MODEL no .env.local."
  }
  if (raw.includes("429") || raw.includes("rate") || raw.includes("quota")) {
    return "Limite temporário da IA. Aguarde alguns segundos — novas tentativas com backoff são feitas automaticamente."
  }
  if (raw.includes("abort") || raw.includes("timeout")) {
    return "A IA demorou para responder. Tente novamente — o payload foi otimizado para evitar timeout."
  }
  if (raw.includes("JSON inválido") || raw.includes("não retornou itens")) {
    return "Resposta da IA veio incompleta. Tente o comando novamente."
  }
  if (raw.startsWith("IA ")) {
    return `Falha na IA: ${raw.substring(0, 220)}`
  }
  return raw.substring(0, 300)
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function formatDateBR(date: Date | string): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}