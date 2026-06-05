"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loading, EmptyState } from "@/components/shared/loading"
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react"
import { CORES_MATERIAS } from "@/lib/constants"
import type { Materia } from "@/types/database"

export default function MateriasPage() {
  return (
    <AppShell>
      <MateriasContent />
    </AppShell>
  )
}

function MateriasContent() {
  const supabase = createClient()
  const [materias, setMaterias] = useState<Materia[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState("")
  const [cor, setCor] = useState(CORES_MATERIAS[0])
  const [editingId, setEditingId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const res = await supabase.from("materias").select("*").eq("escola_id", userData.user.id)
    if (res.data) setMaterias(res.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const data = { escola_id: userData.user.id, nome, cor }
    if (editingId) {
      await supabase.from("materias").update(data).eq("id", editingId)
    } else {
      await supabase.from("materias").insert(data)
    }
    setNome(""); setCor(CORES_MATERIAS[0]); setEditingId(null)
    carregar()
  }

  async function handleDelete(id: string) {
    await supabase.from("materias").delete().eq("id", id)
    carregar()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Matérias</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{editingId ? "Editar" : "Nova"} Matéria</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Matemática" required />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-1">
                {CORES_MATERIAS.slice(0, 8).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCor(c)}
                    className={`h-8 w-8 rounded-full border-2 cursor-pointer ${cor === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <Button type="submit">
              <Plus className="h-4 w-4 mr-1" />
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={() => { setNome(""); setEditingId(null) }}>
                Cancelar
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {materias.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-12 w-12" />} title="Nenhuma matéria cadastrada" />
          ) : (
            <div className="divide-y">
              {materias.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: m.cor }} />
                    <p className="font-medium">{m.nome}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setNome(m.nome); setCor(m.cor); setEditingId(m.id) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
