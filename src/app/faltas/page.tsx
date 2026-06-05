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
import { formatDate } from "@/lib/utils"
import { Plus, UserX } from "lucide-react"
import { MOTIVOS_FALTA } from "@/lib/constants"
import type { Falta, Professor } from "@/types/database"

export default function FaltasPage() {
  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">
          <FaltasContent />
        </main>
      </div>
    </AuthGuard>
  )
}

function FaltasContent() {
  const supabase = createClient()
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    professor_id: "", motivo: "Atestado médico", status: "justificada" as const,
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const eId = userData.user.id

    const [fRes, pRes] = await Promise.all([
      supabase.from("faltas").select("*, professor:professores(*)").eq("escola_id", eId).order("data", { ascending: false }),
      supabase.from("professores").select("*").eq("escola_id", eId),
    ])
    if (fRes.data) setFaltas(fRes.data)
    if (pRes.data) setProfessores(pRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { error } = await supabase.from("faltas").insert({
      escola_id: userData.user.id,
      professor_id: form.professor_id,
      data: new Date().toISOString().split("T")[0],
      motivo: form.motivo,
      status: form.status,
    })

    if (!error) {
      const prof = professores.find((p) => p.id === form.professor_id)
      await supabase.from("professores").update({ status: "ausente" }).eq("id", form.professor_id)
      await supabase.from("eventos_tempo_real").insert({
        escola_id: userData.user.id,
        tipo: "falta",
        mensagem: `${prof?.nome} registrou falta - ${form.motivo}`,
        professor_id: form.professor_id,
      })
      carregar()
    }
    setShowForm(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Faltas</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" /> Registrar Falta
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Registrar Falta</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select value={form.professor_id} onChange={(e) => setForm({ ...form, professor_id: e.target.value })} required>
                  <option value="">Selecionar...</option>
                  {professores.filter((p) => p.status === "presente").map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo</Label>
                <Select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
                  {MOTIVOS_FALTA.map((m) => (<option key={m} value={m}>{m}</option>))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="justificada">Justificada</option>
                  <option value="injustificada">Injustificada</option>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">Registrar</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {faltas.length === 0 ? (
            <EmptyState icon={<UserX className="h-12 w-12" />} title="Nenhuma falta registrada" description="Registre faltas para ativar substituições automáticas" />
          ) : (
            <div className="divide-y">
              {faltas.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{f.professor?.nome}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={f.status === "justificada" ? "success" : "danger"}>{f.status}</Badge>
                      <span className="text-sm text-gray-500">{f.motivo}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">{formatDate(f.data)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
