import type { SupabaseClient } from "@supabase/supabase-js"

export interface FatoMemoria {
  texto: string
  ts: string
  acao?: string
}

export interface AriaMemoria {
  resumo: string
  fatos: FatoMemoria[]
}

const MAX_FATOS = 40

export function memoriaVazia(): AriaMemoria {
  return { resumo: "", fatos: [] }
}

export function formatarMemoriaParaPrompt(memoria: AriaMemoria): string {
  if (!memoria.resumo && !memoria.fatos.length) return ""
  const linhas = memoria.fatos
    .slice(-12)
    .map((f) => `• ${f.texto}`)
    .join("\n")
  return [
    memoria.resumo ? `Resumo: ${memoria.resumo}` : "",
    linhas ? `Fatos recentes:\n${linhas}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
}

export async function carregarMemoria(
  supabase: SupabaseClient,
  escolaId: string
): Promise<AriaMemoria> {
  const { data, error } = await supabase
    .from("aria_contexto")
    .select("resumo, memoria")
    .eq("escola_id", escolaId)
    .maybeSingle()

  if (error) return memoriaVazia()
  if (!data) return memoriaVazia()

  const fatos = Array.isArray(data.memoria)
    ? (data.memoria as FatoMemoria[])
    : []

  return {
    resumo: String(data.resumo || ""),
    fatos: fatos.slice(-MAX_FATOS),
  }
}

export async function salvarMemoria(
  supabase: SupabaseClient,
  escolaId: string,
  memoria: AriaMemoria
): Promise<void> {
  const payload = {
    escola_id: escolaId,
    resumo: memoria.resumo.slice(0, 2000),
    memoria: memoria.fatos.slice(-MAX_FATOS),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("aria_contexto").upsert(payload)
  if (error) {
    console.warn("[ARIA memoria] upsert ignorado:", error.message)
  }
}

export async function adicionarFatoMemoria(
  supabase: SupabaseClient,
  escolaId: string,
  texto: string,
  acao?: string
): Promise<AriaMemoria> {
  const atual = await carregarMemoria(supabase, escolaId)
  atual.fatos.push({
    texto: texto.slice(0, 500),
    ts: new Date().toISOString(),
    acao,
  })
  await salvarMemoria(supabase, escolaId, atual)
  return atual
}

export async function atualizarResumoMemoria(
  supabase: SupabaseClient,
  escolaId: string,
  resumo: string
): Promise<void> {
  const atual = await carregarMemoria(supabase, escolaId)
  atual.resumo = resumo.slice(0, 2000)
  await salvarMemoria(supabase, escolaId, atual)
}