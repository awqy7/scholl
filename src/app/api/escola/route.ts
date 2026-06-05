import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/api-auth"
import { normalizarTipoEscola, type TipoEscola } from "@/lib/escola-tipo"

export async function GET() {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const { data, error } = await auth.supabase
    .from("escolas")
    .select("id, nome, tipo, created_at")
    .eq("id", auth.escolaId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const tipo = normalizarTipoEscola(
    data?.tipo || (auth.user.user_metadata?.tipo_escola as string)
  )

  return NextResponse.json({
    id: auth.escolaId,
    nome: data?.nome || auth.user.email?.split("@")[0] || "Minha Escola",
    tipo,
    created_at: data?.created_at,
  })
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser()
  if ("response" in auth) return auth.response

  const body = await request.json().catch(() => ({}))
  const updates: { nome?: string; tipo?: TipoEscola } = {}

  if (typeof body.nome === "string" && body.nome.trim()) {
    updates.nome = body.nome.trim()
  }
  if (body.tipo === "creche" || body.tipo === "normal") {
    updates.tipo = body.tipo
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 })
  }

  const { data: existing } = await auth.supabase
    .from("escolas")
    .select("id")
    .eq("id", auth.escolaId)
    .maybeSingle()

  if (!existing) {
    await auth.supabase.from("escolas").insert({
      id: auth.escolaId,
      nome: updates.nome || "Minha Escola",
      tipo: updates.tipo || "normal",
    })
  } else {
    const { error } = await auth.supabase
      .from("escolas")
      .update(updates)
      .eq("id", auth.escolaId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, ...updates })
}