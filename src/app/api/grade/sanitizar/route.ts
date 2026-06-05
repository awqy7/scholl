import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { filtrarAulasSemConflitoHorario } from "@/lib/grade-gerador"

/** Remove do banco aulas duplicadas (mesmo professor em várias salas no mesmo horário). */
export async function POST() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const supabase = auth.supabase
  const escolaId = auth.user.id

  const { data: rows, error: fetchErr } = await supabase
    .from("grade_horarios")
    .select("id, turma_id, materia_id, professor_id, dia_semana, periodo_id")
    .eq("escola_id", escolaId)

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  if (!rows?.length) {
    return NextResponse.json({ ok: true, removidas: 0, mantidas: 0 })
  }

  const { aulas: limpas, ignoradas } = filtrarAulasSemConflitoHorario(
    rows.map((r) => ({
      turma_id: r.turma_id,
      materia_id: r.materia_id,
      professor_id: r.professor_id,
      dia_semana: r.dia_semana,
      periodo_id: r.periodo_id,
    }))
  )

  if (ignoradas === 0) {
    return NextResponse.json({ ok: true, removidas: 0, mantidas: limpas.length })
  }

  await supabase.from("grade_horarios").delete().eq("escola_id", escolaId)

  const inserir = limpas.map((a) => ({
    escola_id: escolaId,
    ...a,
  }))

  const { error: insertErr } = await supabase.from("grade_horarios").insert(inserir)
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    removidas: ignoradas,
    mantidas: limpas.length,
    mensagem: `Corrigido: removidas ${ignoradas} aula(s) duplicadas. Cada professor fica em apenas 1 sala por horário.`,
  })
}