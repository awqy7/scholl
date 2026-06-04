import { createBrowserClient } from "@supabase/ssr"
import { getSupabaseAnonKey, getSupabaseUrl } from "./config"

export function createClient() {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    throw new Error(
      "Supabase não configurado. Na tela de login, abra 'Configurar conexão' e cole URL + chave anon."
    )
  }

  return createBrowserClient(url, key)
}