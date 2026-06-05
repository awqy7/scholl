import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    const professorNome = formData.get("professor") as string

    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${Date.now()}-${file.name}`

    const { data: upload, error: uploadError } = await supabase.storage
      .from("atestados")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      // Se bucket não existe, tenta criar
      if (uploadError.message?.includes("bucket")) {
        await supabase.storage.createBucket("atestados", { public: false })
        const { data: retry } = await supabase.storage.from("atestados").upload(fileName, buffer, { contentType: file.type })
        if (!retry) return NextResponse.json({ error: "Erro ao fazer upload" }, { status: 500 })
      } else {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: "Atestado enviado com sucesso!",
      fileName,
      professor: professorNome || "não informado",
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro" }, { status: 500 })
  }
}
