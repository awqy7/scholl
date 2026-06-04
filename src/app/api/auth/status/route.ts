import { NextResponse } from "next/server"
import { supabaseConfigurado } from "@/lib/auth-messages"

export async function GET() {
  return NextResponse.json({
    configurado: supabaseConfigurado(),
    temUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    temKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  })
}