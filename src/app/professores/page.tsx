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
import { Plus, Pencil, Trash2, BookOpen, Brain } from "lucide-react"
import { useToast } from "@/components/shared/toast"
import { z } from "zod"

const professorSchema = z.object({
  nome: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").or(z.literal("")),
  telefone: z.string().optional(),
  especialidades: z.string().optional(),
  status: z.enum(["presente", "ausente", "ferias", "licenca", "atestado"]),
  carga_horaria: z.number().min(1).max(60),
})
import type { Professor } from "@/types/database"

export default function ProfessoresPage() {
  return (
    <AppShell>
      <ProfessoresContent />
    </AppShell>
  )
}

function ProfessoresContent() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    nome: string
    email: string
    telefone: string
    especialidades: string
    status: Professor["status"]
    carga_horaria: number
  }>({
    nome: "", email: "", telefone: "", especialidades: "",
    status: "presente", carga_horaria: 20,
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }

    // Use membership resolver (supports new tenancy model + legacy)
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const res = await supabase
      .from("professores")
      .select("*")
      .eq("escola_id", eId)
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

    const parsed = professorSchema.safeParse({
      ...form,
      carga_horaria: Number(form.carga_horaria),
    })

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || "Dados inválidos"
      showToast(firstError, "error")
      return
    }

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const data = {
      escola_id: eId,
      nome: parsed.data.nome,
      email: parsed.data.email || "",
      telefone: parsed.data.telefone || "",
      especialidades: (parsed.data.especialidades || "").split(",").map((s) => s.trim()).filter(Boolean),
      status: parsed.data.status,
      carga_horaria: parsed.data.carga_horaria,
    }

    if (editingId) {
      const { error } = await supabase.from("professores").update(data).eq("id", editingId)
      if (error) showToast("Erro ao atualizar: " + error.message, "error")
      else showToast("Professor atualizado com sucesso!", "success")
    } else {
      const { error } = await supabase.from("professores").insert(data)
      if (error) showToast("Erro ao cadastrar: " + error.message, "error")
      else showToast("Professor cadastrado com sucesso!", "success")
    }
    resetForm()
    carregar()
  }

  async function handleDelete(id: string, nome: string) {
    if (!window.confirm(`Excluir o professor "${nome}"?\n\nEsta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from("professores").delete().eq("id", id)
    if (error) {
      showToast("Erro ao excluir: " + error.message, "error")
    } else {
      showToast("Professor removido.", "success")
      carregar()
    }
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

  // Simple client-side search (fast UX win)
  const [search, setSearch] = useState("")
  const filteredProfessores = professores.filter((p) =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    (p.especialidades || []).join(" ").toLowerCase().includes(search.toLowerCase())
  )

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Professores</h1>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Buscar por nome ou especialidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => { resetForm(); setShowForm(!showForm) }}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancelar" : "Novo Professor"}
          </Button>
        </div>
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
              {filteredProfessores.map((p) => (
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
                    <Button variant="ghost" size="sm" onClick={() => editProf(p)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent("aria:abrir-chat"))
                        // User can then type: "relatório do [nome]" or "detalhes do professor [nome]"
                      }}
                      title="Relatório e análise com ARIA"
                    >
                      <Brain className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.nome)} title="Excluir">
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
