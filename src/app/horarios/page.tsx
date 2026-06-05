"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { Plus, Pencil, Trash2, Clock } from "lucide-react"
import type { Periodo } from "@/types/database"

export default function HorariosPage() {
  return (
    <AppShell>
      <HorariosContent />
    </AppShell>
  )
}

function HorariosContent() {
  const supabase = createClient()
  const [periodos, setPeriodos] = useState<Periodo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    nome: string
    tipo: Periodo["tipo"]
    hora_inicio: string
    hora_fim: string
    ordem: number
  }>({
    nome: "", tipo: "aula", hora_inicio: "08:00", hora_fim: "08:50", ordem: 1,
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const res = await supabase.from("periodos").select("*").eq("escola_id", userData.user.id).order("ordem")
    if (res.data) setPeriodos(res.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const data = { escola_id: userData.user.id, ...form }

    if (editingId) {
      await supabase.from("periodos").update(data).eq("id", editingId)
    } else {
      await supabase.from("periodos").insert(data)
    }
    setShowForm(false); setEditingId(null)
    setForm({ nome: "", tipo: "aula", hora_inicio: "08:00", hora_fim: "08:50", ordem: periodos.length + 1 })
    carregar()
  }

  async function handleDelete(id: string) {
    await supabase.from("periodos").delete().eq("id", id)
    carregar()
  }

  const tipoVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
    entrada: "success", aula: "default", recreio: "warning", saida: "danger",
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Períodos / Horários</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Período
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">{editingId ? "Editar" : "Novo"} Período</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: 1º Aula" required />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as any })}>
                  <option value="entrada">Entrada</option>
                  <option value="aula">Aula</option>
                  <option value="recreio">Recreio</option>
                  <option value="saida">Saída</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} required />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit">{editingId ? "Salvar" : "Criar"}</Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {periodos.length === 0 ? (
            <EmptyState icon={<Clock className="h-12 w-12" />} title="Nenhum período cadastrado" description="Defina os períodos do dia (entrada, aulas, recreio, saída)" />
          ) : (
            <div className="divide-y">
              {periodos.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <Badge variant={tipoVariant[p.tipo]}>{p.tipo}</Badge>
                    <div>
                      <p className="font-medium">{p.nome}</p>
                      <p className="text-sm text-gray-500">{p.hora_inicio} - {p.hora_fim}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setForm(p); setEditingId(p.id); setShowForm(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
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
