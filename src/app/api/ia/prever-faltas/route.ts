import { NextResponse } from "next/server"
import { preverFaltas } from "@/lib/ia"
import { formatIaError } from "@/lib/ia-utils"
import { requireApiUser } from "@/lib/api-auth"

export const maxDuration = 60

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const { historicoProfessores, diasSemana } = await request.json()

    if (!historicoProfessores?.length) {
      return NextResponse.json(
        { error: "Nenhum histórico de professores para análise." },
        { status: 400 }
      )
    }

    const resultado = await preverFaltas(historicoProfessores, diasSemana || [])

    return NextResponse.json({ ...((resultado as object) || {}), modo: "ia" })
  } catch (err) {
    return NextResponse.json({ error: formatIaError(err) }, { status: 502 })
  }
}