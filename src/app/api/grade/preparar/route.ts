import { NextResponse } from "next/server"
import { garantirPeriodosParaGrade } from "@/lib/garantir-periodos-grade"
import { requireApiUser } from "@/lib/api-auth"

/** Garante períodos vespertinos quando há turmas da tarde (antes de exibir/gerar grade). */
export async function POST() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const prep = await garantirPeriodosParaGrade(auth.supabase, auth.escolaId)
  return NextResponse.json({
    ok: true,
    criados: prep.criados,
    mensagem: prep.mensagem,
    temTurmaTarde: prep.temTurmaTarde,
    temPeriodoVespertino: prep.temPeriodoVespertino,
  })
}