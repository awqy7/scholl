"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loading, EmptyState } from "@/components/shared/loading"
import { formatDate } from "@/lib/utils"
import { RefreshCw, Sparkles, Check, X } from "lucide-react"
import type { Substituicao, Falta, Professor } from "@/types/database"

export default function SubstituicoesPage() {
  return (
    <AppShell>
      <SubstituicoesContent />
    </AppShell>
  )
}

function SubstituicoesContent() {
  const supabase = createClient()
  const [substituicoes, setSubstituicoes] = useState<Substituicao[]>([])
  const [faltas, setFaltas] = useState<Falta[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [loading, setLoading] = useState(true)
  const [sugerindo, setSugerindo] = useState(false)

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const [sRes, fRes, pRes] = await Promise.all([
      supabase.from("substituicoes").select("*, professor_original:professores!professor_original_id(*), professor_substituto:professores!professor_substituto_id(*)").eq("escola_id", eId).order("created_at", { ascending: false }),
      supabase.from("faltas").select("*, professor:professores(*)").eq("escola_id", eId).order("data", { ascending: false }),
      supabase.from("professores").select("*").eq("escola_id", eId),
    ])
    if (sRes.data) setSubstituicoes(sRes.data)
    if (fRes.data) setFaltas(fRes.data)
    if (pRes.data) setProfessores(pRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function handleSugerirSubstituto(sub: Falta) {
    setSugerindo(true)
    try {
      const res = await fetch("/api/ia/sugerir-substituto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professorAusente: sub.professor,
          professoresDisponiveis: professores.filter((p) => p.status === "presente" && p.id !== sub.professor_id),
          materia: "",
          horario: { dia: sub.data, inicio: "08:00", fim: "17:00" },
        }),
      })
      if (!res.ok) throw new Error("Erro")
      const sugestao = await res.json()

      const nomeIa = String(sugestao.substituto || "").toLowerCase().trim()
      const substituto = professores.find((p) => p.nome.toLowerCase() === nomeIa)
        || professores.find((p) => p.nome.toLowerCase().includes(nomeIa) || nomeIa.includes(p.nome.toLowerCase()))
      if (substituto) {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) return
        const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
        const eId = await getCurrentEscolaId(userData.user.id)
        await supabase.from("substituicoes").insert({
          escola_id: eId,
          falta_id: sub.id,
          professor_original_id: sub.professor_id,
          professor_substituto_id: substituto.id,
          data: sub.data,
          status: "pendente",
        })
        await supabase.from("eventos_tempo_real").insert({
          escola_id: eId,
          tipo: "substituicao",
          mensagem: `IA sugeriu ${substituto.nome} para substituir ${sub.professor?.nome}`,
          professor_id: substituto.id,
        })
        carregar()
      }
    } catch (err) {
      alert("Erro ao sugerir substituto. Configure a chave IA.")
    }
    setSugerindo(false)
  }

  async function handleStatus(id: string, status: "confirmada" | "recusada") {
    await supabase.from("substituicoes").update({ status }).eq("id", id)
    carregar()
  }

  const faltasSemSubstituicao = faltas.filter(
    (f) => !substituicoes.some((s) => s.falta_id === f.id)
  )

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Substituições</h1>
      </div>

      {faltasSemSubstituicao.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-600" />
              Faltas sem substituição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {faltasSemSubstituicao.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{f.professor?.nome}</p>
                    <p className="text-sm text-gray-500">{f.motivo} - {formatDate(f.data)}</p>
                  </div>
                  <Button size="sm" onClick={() => handleSugerirSubstituto(f)} disabled={sugerindo}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    Sugerir Substituto (IA)
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Substituições registradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {substituicoes.length === 0 ? (
            <EmptyState icon={<RefreshCw className="h-12 w-12" />} title="Nenhuma substituição" description="Registre faltas para ativar substituições automáticas" />
          ) : (
            <div className="divide-y">
              {substituicoes.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{s.professor_original?.nome}</p>
                    <p className="text-sm text-gray-500">
                      Substituído por <strong>{s.professor_substituto?.nome}</strong>
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(s.data)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "confirmada" ? "success" : s.status === "recusada" ? "danger" : "warning"}>
                      {s.status}
                    </Badge>
                    {s.status === "pendente" && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(s.id, "confirmada")}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleStatus(s.id, "recusada")}>
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
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
