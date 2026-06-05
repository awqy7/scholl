import { NextResponse } from "next/server"
import { testarConexaoIA } from "@/lib/ia-client"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 90

export async function GET() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const resultado = await testarConexaoIA()

  if (!resultado.ok) {
    return NextResponse.json(
      { ...resultado, error: formatIaError(resultado.erro) },
      { status: 502 }
    )
  }

  return NextResponse.json(resultado)
}