import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { requireApiUser } from "@/lib/api-auth"

export async function POST(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  try {
    const { supabase, escolaId } = auth
    const formData = await request.formData()
    const file = formData.get("file") as File
    const professorTexto = (formData.get("professor") as string) || ""

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`

    let uploadOk = false
    const { error: uploadError } = await supabase.storage
      .from("atestados")
      .upload(fileName, buffer, { contentType: file.type, upsert: true })

    if (!uploadError) {
      uploadOk = true
    } else if (uploadError.message?.includes("bucket")) {
      await supabase.storage.createBucket("atestados", { public: false })
      const { error: retry } = await supabase.storage
        .from("atestados")
        .upload(fileName, buffer, { contentType: file.type })
      uploadOk = !retry
    }

    let faltaRegistrada = false
    let professorNome = ""

    const nomeMatch = professorTexto.match(/(.+?)\s+(?:faltou|ausente)/i)
      || professorTexto.match(/(?:atestado|falta)\s+(?:do|da|de)\s+(.+)/i)
      || (professorTexto.length > 2 && !professorTexto.includes("(") ? [null, professorTexto] : null)

    const buscaNome = nomeMatch?.[1]?.trim() || professorTexto.trim()

    if (buscaNome && buscaNome.length > 2) {
      const { data: profs } = await supabase
        .from("professores")
        .select("id, nome")
        .eq("escola_id", escolaId)
        .ilike("nome", `%${buscaNome.split(/\s+/)[0]}%`)

      const prof =
        profs?.find((p) => p.nome.toLowerCase() === buscaNome.toLowerCase()) ||
        profs?.find((p) => p.nome.toLowerCase().includes(buscaNome.toLowerCase())) ||
        profs?.[0]

      if (prof) {
        professorNome = prof.nome
        await supabase.from("professores").update({ status: "ausente" }).eq("id", prof.id)
        await supabase.from("faltas").insert({
          escola_id: escolaId,
          professor_id: prof.id,
          data: new Date().toISOString().split("T")[0],
          motivo: uploadOk ? `Atestado anexado: ${fileName}` : `Atestado (upload pendente): ${file.name}`,
          status: "justificada",
        })
        await supabase.from("eventos_tempo_real").insert({
          escola_id: escolaId,
          tipo: "falta",
          mensagem: `${prof.nome} — atestado recebido`,
          professor_id: prof.id,
        })
        faltaRegistrada = true
      }
    }

    if (!uploadOk && !faltaRegistrada) {
      return NextResponse.json({ error: "Erro ao fazer upload do atestado" }, { status: 500 })
    }

    return NextResponse.json({
      message: faltaRegistrada
        ? `Atestado salvo e falta registrada para ${professorNome}.`
        : "Atestado enviado. Informe o nome do professor no comando para registrar a falta.",
      fileName,
      faltaRegistrada,
      professor: professorNome || buscaNome || "não identificado",
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}