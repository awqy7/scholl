import { createServerSupabase } from "@/lib/supabase/server"
import { garantirDadosEscola } from "@/lib/escola-setup"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const escolaId = user.id
  const { data: escola } = await supabase
    .from("escolas")
    .select("tipo")
    .eq("id", escolaId)
    .maybeSingle()

  const resultado = await garantirDadosEscola(supabase, escolaId, {
    completo: true,
    tipo: escola?.tipo,
  })

  const total =
    resultado.series +
    resultado.turmas +
    resultado.professores +
    resultado.materias +
    resultado.periodos

  return NextResponse.json({
    message: total > 0 ? "Dados criados/completados com sucesso!" : resultado.mensagem,
    stats: {
      series: resultado.series,
      turmas: resultado.turmas,
      professores: resultado.professores,
      materias: resultado.materias,
      periodos: resultado.periodos,
    },
  })
}