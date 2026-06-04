"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { AuthGuard } from "@/components/layout/auth-guard"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/shared/loading"
import {
  Users, BookOpen, Clock, AlertTriangle,
  UserCheck, RefreshCw, School, TreePine
} from "lucide-react"
import Link from "next/link"
import type { Turma, Professor, EventoTempoReal } from "@/types/database"

export default function DashboardPage() {
  return (
    <AuthGuard>
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 p-8">
          <DashboardContent />
        </main>
      </div>
    </AuthGuard>
  )
}

function DashboardContent() {
  const supabase = createClient()
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [eventos, setEventos] = useState<EventoTempoReal[]>([])
  const [loading, setLoading] = useState(true)
  const [horaAtual, setHoraAtual] = useState(new Date())
  const [escolaNome, setEscolaNome] = useState("")

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const carregarDados = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const escolaId = userData.user.id

    const [turmasRes, profsRes, eventosRes, subsRes] = await Promise.all([
      supabase.from("turmas").select("*, serie:series(*)").eq("escola_id", escolaId),
      supabase.from("professores").select("*").eq("escola_id", escolaId),
      supabase.from("eventos_tempo_real").select("*, turma:turmas(*), professor:professores(*)").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20),
      supabase.from("substituicoes").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("status", "pendente"),
    ])

    if (turmasRes.data) setTurmas(turmasRes.data)
    if (profsRes.data) setProfessores(profsRes.data)
    if (eventosRes.data) setEventos(eventosRes.data)
    setSubstituicoesPendentes(subsRes.count || 0)
    if (userData.user.email) setEscolaNome(userData.user.email.split("@")[0])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 10000)
    return () => clearInterval(interval)
  }, [carregarDados])

  // Auto seed quando não há dados
  useEffect(() => {
    if (!loading && turmas.length === 0 && professores.length === 0) {
      fetch("/api/seed", { method: "POST" }).then((res) => {
        if (res.ok) carregarDados()
      })
    }
  }, [loading])

  const professoresPresentes = professores.filter((p) => p.status === "presente").length
  const professoresAusentes = professores.filter((p) => p.status === "ausente").length
  const [substituicoesPendentes, setSubstituicoesPendentes] = useState(0)

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {horaAtual.toLocaleDateString("pt-BR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric"
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          {horaAtual.toLocaleTimeString("pt-BR")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard icon={School} label="Turmas" value={turmas.length} color="blue" />
        <StatsCard icon={Users} label="Professores" value={professores.length} color="green" />
        <StatsCard icon={UserCheck} label="Presentes" value={professoresPresentes} color="green" />
        <StatsCard icon={AlertTriangle} label="Ausentes" value={professoresAusentes} color="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Timeline da Escola
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eventos.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Nenhum evento registrado hoje
                </p>
              ) : (
                eventos.map((evento) => (
                  <div key={evento.id} className="flex items-start gap-3 border-l-2 border-blue-200 pl-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <EventIcon tipo={evento.tipo} />
                        <p className="text-sm font-medium">{evento.mensagem}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(evento.created_at).toLocaleTimeString("pt-BR")}
                      </p>
                    </div>
                    {evento.turma && (
                      <Badge variant="outline">{evento.turma.nome}</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Alertas Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {professoresAusentes > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800">
                        {professoresAusentes} professor(es) ausente(s)
                      </p>
                      <Link href="/substituicoes" className="text-xs text-red-600 hover:underline">
                        Ver substituições
                      </Link>
                    </div>
                  </div>
                )}
                {substituicoesPendentes > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-yellow-50 p-3">
                    <RefreshCw className="h-4 w-4 text-yellow-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">
                        {substituicoesPendentes} substituição(ões) pendente(s)
                      </p>
                    </div>
                  </div>
                )}
                {professoresAusentes === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum alerta no momento
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TreePine className="h-5 w-5 text-green-600" />
                Recreio Agora
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 text-center py-4">
                Consulte a página de Recreio
              </p>
              <Link href="/recreio">
                <Button variant="outline" className="w-full">
                  Ver Recreios
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function StatsCard({
  icon: Icon, label, value, color
}: {
  icon: React.ElementType
  label: string
  value: number
  color: "blue" | "green" | "red" | "yellow"
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    yellow: "bg-yellow-50 text-yellow-600",
  }
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
          <div className={`rounded-xl p-3 ${colors[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EventIcon({ tipo }: { tipo: string }) {
  const icons: Record<string, React.ReactNode> = {
    inicio_aula: <BookOpen className="h-4 w-4 text-green-600" />,
    fim_aula: <BookOpen className="h-4 w-4 text-gray-400" />,
    inicio_recreio: <TreePine className="h-4 w-4 text-green-600" />,
    fim_recreio: <TreePine className="h-4 w-4 text-gray-400" />,
    falta: <AlertTriangle className="h-4 w-4 text-red-600" />,
    substituicao: <RefreshCw className="h-4 w-4 text-yellow-600" />,
    alerta: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  }
  return icons[tipo] || <Clock className="h-4 w-4 text-gray-400" />
}
