"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { AuthGuard } from "@/components/layout/auth-guard"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { DIAS_SEMANA } from "@/lib/utils"
import { persistRecreioIntercalado } from "@/lib/persist-ia"
import { TreePine, Sparkles, Trash2 } from "lucide-react"
import type { RecreioIntercalado, Turma } from "@/types/database"

export default function RecreioPage() {
  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">
          <RecreioContent />
        </main>
      </div>
    </AuthGuard>
  )
}

function RecreioContent() {
  const supabase = createClient()
  const [recreios, setRecreios] = useState<RecreioIntercalado[]>([])
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [loading, setLoading] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [duracao, setDuracao] = useState(20)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const eId = userData.user.id

    const [tRes, rRes] = await Promise.all([
      supabase.from("turmas").select("*, serie:series(*)").eq("escola_id", eId),
      supabase.from("recreio_intercalado").select("*, turma:turmas(*)").eq("escola_id", eId).order("dia_semana"),
    ])
    if (tRes.data) setTurmas(tRes.data)
    if (rRes.data) setRecreios(rRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleGerar() {
    setGerando(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error("Não autenticado")

      const res = await fetch("/api/ia/gerar-recreio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, periodo: t.periodo })),
          espacosDisponiveis: 1,
          duracao,
        }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Erro ao gerar recreio")

      const resultado = await persistRecreioIntercalado(
        supabase,
        userData.user.id,
        payload,
        turmas.map((t) => ({ id: t.id, nome: t.nome, periodo: t.periodo }))
      )
      if (!resultado.ok) throw new Error(resultado.mensagem)
      alert(resultado.mensagem)
      carregar()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao gerar recreio. Chave IA necessária.")
    }
    setGerando(false)
  }

  async function handleRemover() {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase.from("recreio_intercalado").delete().eq("escola_id", userData.user.id)
    carregar()
  }

  const recreiosPorDia = DIAS_SEMANA.map((_, idx) =>
    recreios.filter((r) => r.dia_semana === idx)
  )

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recreio Intercalado</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Duração (min):</Label>
            <Select value={String(duracao)} onChange={(e) => setDuracao(Number(e.target.value))} className="w-24">
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="25">25</option>
              <option value="30">30</option>
            </Select>
          </div>
          <Button variant="outline" onClick={handleRemover}>
            <Trash2 className="h-4 w-4 mr-1" /> Limpar
          </Button>
          <Button onClick={handleGerar} disabled={gerando}>
            <Sparkles className="h-4 w-4 mr-1" />
            {gerando ? "Gerando..." : "Gerar Recreio com IA"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {recreiosPorDia.map((recDia, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="text-sm">{DIAS_SEMANA[idx]}</CardTitle>
            </CardHeader>
            <CardContent>
              {recDia.length === 0 ? (
                <p className="text-xs text-gray-400">Sem recreio</p>
              ) : (
                <div className="space-y-2">
                  {recDia
                    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                    .map((r) => (
                      <div key={r.id} className="rounded-lg bg-green-50 p-2 text-xs">
                        <div className="font-medium">{r.turma?.nome}</div>
                        <div className="text-green-700">{r.hora_inicio} - {r.hora_fim}</div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TreePine className="h-5 w-5 text-green-600" />
            Recreio Agora
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RecreioAgora recreios={recreios} />
        </CardContent>
      </Card>
    </div>
  )
}

function RecreioAgora({ recreios }: { recreios: RecreioIntercalado[] }) {
  const agora = new Date()
  const horaAtual = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`
  const diaSemana = (agora.getDay() + 6) % 7

  const recreioAtual = recreios.find(
    (r) => r.dia_semana === diaSemana && r.hora_inicio <= horaAtual && r.hora_fim >= horaAtual
  )

  const proximos = recreios
    .filter((r) => r.dia_semana === diaSemana && r.hora_inicio > horaAtual)
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
    .slice(0, 3)

  return (
    <div className="space-y-3">
      {recreioAtual ? (
        <div className="rounded-lg bg-green-100 p-4 text-center">
          <p className="text-lg font-bold text-green-800">{recreioAtual.turma?.nome}</p>
          <p className="text-sm text-green-600">No recreio agora! ({recreioAtual.hora_inicio} - {recreioAtual.hora_fim})</p>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">Nenhuma turma no recreio agora</p>
      )}

      {proximos.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-500 mb-2">Próximos recreios:</p>
          {proximos.map((r) => (
            <div key={r.id} className="flex justify-between text-sm py-1">
              <span>{r.turma?.nome}</span>
              <span className="text-gray-500">{r.hora_inicio}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
