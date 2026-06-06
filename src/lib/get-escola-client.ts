import { createClient } from "@/lib/supabase/client"

/**
 * Client-side only resolver for the current user's escola_id.
 * Uses escola_membros (new tenancy model) with legacy fallback (user.id).
 * Safe to call from any client component.
 */
export async function getCurrentEscolaId(userId: string): Promise<string> {
  const supabase = createClient()

  try {
    const { data: membro } = await supabase
      .from("escola_membros")
      .select("escola_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle()

    if (membro?.escola_id) {
      return membro.escola_id
    }
  } catch {
    // table may not exist yet (user didn't run 00005 migration)
  }

  // Legacy fallback (old installations where escola.id === auth user id)
  return userId
}

/**
 * Convenience: get user + resolved escolaId in one call (common pattern in pages).
 */
export async function getCurrentUserAndEscola() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, escolaId: null }

  const escolaId = await getCurrentEscolaId(user.id)
  return { user, escolaId }
}