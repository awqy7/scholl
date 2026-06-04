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
  const cleaned = content.replace(/```json|```/g, "").trim()
  return JSON.parse(cleaned)
}