"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { AuthGuard } from "@/components/layout/auth-guard"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react"
import type { Professor } from "@/types/database"

export default function ProfessoresPage() {
  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">
          <ProfessoresContent />
        </main>
      </div>
    </AuthGuard>
  )
}

function ProfessoresContent() {
  const supabase = createClient()
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", especialidades: "",
    status: "presente" as const, carga_horaria: 20,
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const res = await supabase
      .from("professores")
      .select("*")
      .eq("escola_id", userData.user.id)
    if (res.data) setProfessores(res.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const onFocus = () => carregar()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const data = {
      escola_id: userData.user.id,
      ...form,
      especialidades: form.especialidades.split(",").map((s) => s.trim()),
    }

    if (editingId) {
      await supabase.from("professores").update(data).eq("id", editingId)
    } else {
      await supabase.from("professores").insert(data)
    }
    resetForm()
    carregar()
  }

  async function handleDelete(id: string) {
    await supabase.from("professores").delete().eq("id", id)
    carregar()
  }

  function editProf(p: Professor) {
    setForm({
      nome: p.nome, email: p.email, telefone: p.telefone,
      especialidades: p.especialidades.join(", "),
      status: p.status, carga_horaria: p.carga_horaria,
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  function resetForm() {
    setForm({ nome: "", email: "", telefone: "", especialidades: "", status: "presente", carga_horaria: 20 })
    setEditingId(null)
    setShowForm(false)
  }

  const statusVariant = (s: string) => {
    if (s === "presente") return "success"
    if (s === "ausente") return "danger"
    return "warning"
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Professores</h1>
        <Button onClick={() => { resetForm(); setShowForm(!showForm) }}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? "Cancelar" : "Novo Professor"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Editar Professor" : "Novo Professor"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Carga Horária (h/semana)</Label>
                  <Input type="number" value={form.carga_horaria} onChange={(e) => setForm({ ...form, carga_horaria: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                    <option value="presente">Presente</option>
                    <option value="ausente">Ausente</option>
                    <option value="ferias">Férias</option>
                    <option value="licenca">Licença</option>
                    <option value="atestado">Atestado</option>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Especialidades (separadas por vírgula)</Label>
                  <Input value={form.especialidades} onChange={(e) => setForm({ ...form, especialidades: e.target.value })} placeholder="Ex: Matemática, Português, Educação Infantil" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? "Salvar" : "Criar Professor"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {professores.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-12 w-12" />} title="Nenhum professor cadastrado" description="Adicione professores para começar" />
          ) : (
            <div className="divide-y">
              {professores.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{p.nome}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                      {p.especialidades.map((esp, i) => (
                        <Badge key={i} variant="outline">{esp}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{p.email} | {p.carga_horaria}h/semana</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => editProf(p)}>
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
