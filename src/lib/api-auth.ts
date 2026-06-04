import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

type AuthOk = { user: User; escolaId: string; supabase: Awaited<ReturnType<typeof createServerSupabase>> }
type AuthFail = { response: NextResponse }

export async function requireApiUser(): Promise<AuthOk | AuthFail> {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }
  }

  return { user, escolaId: user.id, supabase }
}