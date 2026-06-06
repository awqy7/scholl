import { createClient } from "@/lib/supabase/client"

/**
 * Helper compartilhado para obter o escolaId atual com segurança.
 * Reduz duplicação de getUser + getCurrentEscolaId em todas as páginas.
 */
export async function getEscolaId(): Promise<string> {
  const supabase = createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error("Usuário não autenticado")
  const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
  return getCurrentEscolaId(userData.user.id)
}
