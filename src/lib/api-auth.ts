import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

type AuthOk = { user: User; escolaId: string; supabase: Awaited<ReturnType<typeof createServerSupabase>> }
type AuthFail = { response: NextResponse }

/**
 * Resolve the escola_id for the current authenticated user.
 * Priority:
 * 1. Look up in escola_membros (new proper tenancy model)
 * 2. Fallback to legacy (user.id) for old installations before 00005 migration
 */
async function resolveEscolaId(supabase: Awaited<ReturnType<typeof createServerSupabase>>, userId: string): Promise<string> {
  // Try new membership table first
  const { data: membro } = await supabase
    .from("escola_membros")
    .select("escola_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (membro?.escola_id) {
    return membro.escola_id
  }

  // Legacy fallback: many existing installs had escola.id === auth.users.id
  // This keeps old accounts working until they run the migration + backfill.
  return userId
}

export async function requireApiUser(): Promise<AuthOk | AuthFail> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }

  const escolaId = await resolveEscolaId(supabase, user.id)

  return { user, escolaId, supabase }
}

/** Client-side helper to resolve current user's escola_id (with legacy fallback) */
export async function getCurrentEscolaId(supabase: any, userId: string): Promise<string> {
  const { data: membro } = await supabase
    .from("escola_membros")
    .select("escola_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  if (membro?.escola_id) return membro.escola_id

  // Legacy
  return userId
}