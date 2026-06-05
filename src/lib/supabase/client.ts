import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseUrl } from "./config"

export function createClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local."
    )
  }

  return createBrowserClient(url, key)
}