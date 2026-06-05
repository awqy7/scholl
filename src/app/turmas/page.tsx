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
import { Plus, Pencil, Trash2, Users, RefreshCw } from "lucide-react"
import Link from "next/link"
import type { Turma, Serie } from "@/types/database"

export default function TurmasPage() {
  return (
    <AppShell>
      <TurmasContent />
    </AppShell>
  )
}

function TurmasContent() {
  const supabase = createClient()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [series, setSeries] = useState<Serie[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState("")
  const [serieId, setSerieId] = useState("")
  const [periodo, setPeriodo] = useState("manha")
  const [novaSerie, setNovaSerie] = useState("")

  const escolaId = "escola_id_placeholder"

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }
    const eId = userData.user.id

    const [turmasRes, seriesRes] = await Promise.all([
      supabase.from("turmas").select("*, serie:series(*)").eq("escola_id", eId),
      supabase.from("series").select("*").eq("escola_id", eId).order("ordem"),
    ])
    if (turmasRes.data) setTurmas(turmasRes.data)
    if (seriesRes.data) setSeries(seriesRes.data)
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
    const eId = userData.user.id

    const data = { escola_id: eId, nome, serie_id: serieId, periodo }

    if (editingId) {
      await supabase.from("turmas").update(data).eq("id", editingId)
    } else {
      await supabase.from("turmas").insert(data)
    }

    resetForm()
    carregar()
  }

  async function handleDelete(id: string) {
    await supabase.from("turmas").delete().eq("id", id)
    carregar()
  }

  function editTurma(t: Turma) {
    setNome(t.nome)
    setSerieId(t.serie_id)
    setPeriodo(t.periodo)
    setEditingId(t.id)
    setShowForm(true)
  }

  async function addSerie() {
    if (!novaSerie) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("series").insert({
      escola_id: userData.user.id,
      nome: novaSerie,
      ordem: series.length + 1,
    })
    setNovaSerie("")
    carregar()
  }

  function resetForm() {
    setNome("")
    setSerieId("")
    setPeriodo("manha")
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Turmas</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(!showForm) }}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancelar" : "Nova Turma"}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId ? "Editar Turma" : "Nova Turma"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da Turma</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maternal A" required />
                </div>
                <div className="space-y-2">
                  <Label>Série</Label>
                  <div className="flex gap-2">
                    <Select value={serieId} onChange={(e) => setSerieId(e.target.value)} required>
                      <option value="">Selecionar...</option>
                      {series.map((s) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="integral">Integral</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? "Salvar" : "Criar Turma"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>

            <div className="mt-6 border-t border-indigo-500/20 pt-4">
              <Label className="mb-2 block">Adicionar nova série</Label>
              <div className="flex gap-2">
                <Input value={novaSerie} onChange={(e) => setNovaSerie(e.target.value)} placeholder="Ex: Jardim 3" />
                <Button type="button" variant="outline" onClick={addSerie}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {turmas.length === 0 ? (
            <EmptyState
              icon={<Users className="h-12 w-12" />}
              title="Nenhuma turma cadastrada"
              description="Crie sua primeira turma para começar"
            />
          ) : (
            <div className="divide-y">
              {turmas.map((turma) => (
                <div key={turma.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{turma.nome}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">{turma.serie?.nome}</Badge>
                      <Badge variant="default">{turma.periodo}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => editTurma(turma)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(turma.id)}>
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
