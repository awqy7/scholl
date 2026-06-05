import { NextResponse } from "next/server"
import { testarConexaoIA } from "@/lib/ia-client"
import { formatIaError } from "@/lib/ia-utils"

export const maxDuration = 90

/** Diagnóstico sem login — apenas em desenvolvimento */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponível em produção" }, { status: 404 })
  }

  const resultado = await testarConexaoIA()

  if (!resultado.ok) {
    return NextResponse.json(
      { ...resultado, error: formatIaError(resultado.erro) },
      { status: 502 }
    )
  }

  return NextResponse.json({ ...resultado, mensagem: "IA operacional" })
}