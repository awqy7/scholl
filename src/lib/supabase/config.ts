const STORAGE_URL = "escola_supabase_url"
const STORAGE_KEY = "escola_supabase_anon_key"

export function getSupabaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_URL)
    if (stored) return stored
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ""
}

export function getSupabaseAnonKey(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
}

export function isSupabaseReady(): boolean {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  return Boolean(url && key && !url.includes("seu-projeto") && key !== "sua-chave-anon")
}

export function salvarSupabaseLocal(url: string, anonKey: string) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_URL, url.trim())
  localStorage.setItem(STORAGE_KEY, anonKey.trim())
}

export function limparSupabaseLocal() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_URL)
  localStorage.removeItem(STORAGE_KEY)
}

export function gerarEnvLocal(url: string, anonKey: string): string {
  return `NEXT_PUBLIC_SUPABASE_URL=${url.trim()}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey.trim()}
IA_API_KEY=sua-chave-openrouter
OPENROUTER_MODEL=openai/gpt-oss-120b:free
NEXT_PUBLIC_IA_PROVIDER=openrouter`
}