"use client"

import { AppShell } from "@/components/layout/app-shell"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState, useCallback, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loading } from "@/components/shared/loading"
import {
  Users, BookOpen, Clock, AlertTriangle,
  UserCheck, RefreshCw, School, TreePine,
  Brain, TrendingUp, Activity, Zap, Calendar,
  ChevronRight, ArrowUp, ArrowDown,
} from "lucide-react"
import Link from "next/link"
import type { Turma, Professor, EventoTempoReal } from "@/types/database"
import { useEscola } from "@/lib/escola-context"
import { escolaTemRecreioIntercalado } from "@/lib/escola-tipo"

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  )
}

function DashboardContent() {
  const supabase = createClient()
  const { tipo, config, nome: nomeEscolaCtx } = useEscola()
  const mostraRecreio = escolaTemRecreioIntercalado(tipo)
  const [turmas, setTurmas] = useState<Turma[]>([])
  const [professores, setProfessores] = useState<Professor[]>([])
  const [eventos, setEventos] = useState<EventoTempoReal[]>([])
  const [loading, setLoading] = useState(true)
  const [horaAtual, setHoraAtual] = useState(new Date())
  const [escolaNome, setEscolaNome] = useState("")
  const [substituicoesPendentes, setSubstituicoesPendentes] = useState(0)
  const [totalAulas, setTotalAulas] = useState(0)
  const [totalFaltasHoje, setTotalFaltasHoje] = useState(0)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const carregarDados = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const escolaId = userData.user.id

    const [turmasRes, profsRes, eventosRes, subsRes, gradeRes, faltasRes] = await Promise.all([
      supabase.from("turmas").select("*, serie:series(*)").eq("escola_id", escolaId),
      supabase.from("professores").select("*").eq("escola_id", escolaId),
      supabase
        .from("eventos_tempo_real")
        .select("*, turma:turmas(*), professor:professores(*)")
        .eq("escola_id", escolaId)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("substituicoes")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("status", "pendente"),
      supabase
        .from("grade_horarios")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId),
      supabase
        .from("faltas")
        .select("id", { count: "exact", head: true })
        .eq("escola_id", escolaId)
        .eq("data", new Date().toISOString().split("T")[0]),
    ])

    if (turmasRes.data) setTurmas(turmasRes.data)
    if (profsRes.data) setProfessores(profsRes.data)
    if (eventosRes.data) setEventos(eventosRes.data)
    setSubstituicoesPendentes(subsRes.count || 0)
    setTotalAulas(gradeRes.count || 0)
    setTotalFaltasHoje(faltasRes.count || 0)
    const { data: escola } = await supabase
      .from("escolas")
      .select("nome")
      .eq("id", escolaId)
      .maybeSingle()
    setEscolaNome(escola?.nome || nomeEscolaCtx || userData.user.email?.split("@")[0] || "Escola")
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  // Realtime subscription - mais eficiente que polling
  useEffect(() => {
    let cancelled = false

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }

      const channel = supabase
        .channel(`dashboard-realtime-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "eventos_tempo_real" },
          () => { if (!cancelled) void carregarDados() }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "professores" },
          () => { if (!cancelled) void carregarDados() }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "faltas" },
          () => { if (!cancelled) void carregarDados() }
        )
        .subscribe()

      if (cancelled) {
        supabase.removeChannel(channel)
        return
      }

      channelRef.current = channel
    }

    void setupRealtime()

    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, carregarDados])

  // Auto seed quando não há dados
  useEffect(() => {
    if (!loading && turmas.length === 0 && professores.length === 0) {
      fetch("/api/seed", { method: "POST" }).then((res) => {
        if (res.ok) carregarDados()
      })
    }
  }, [loading]) // eslint-disable-line

  const professoresPresentes = professores.filter((p) => p.status === "presente").length
  const professoresAusentes = professores.filter((p) => p.status !== "presente").length
  const presencaPercent = professores.length > 0
    ? Math.round((professoresPresentes / professores.length) * 100)
    : 0

  if (loading) return <Loading />

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Bem-vindo, <span className="gradient-text">{escolaNome || "Escola"}</span>
          </h1>
          <p className="text-xs text-indigo-400/80 mt-1">{config.label}</p>
          <p className="text-sm text-indigo-300/70 mt-1 capitalize">
            {horaAtual.toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            style={{
              background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.2)",
            }}
          >
            <Clock className="h-4 w-4 text-indigo-400" />
            <span className="text-white font-mono font-semibold">
              {horaAtual.toLocaleTimeString("pt-BR")}
            </span>
          </div>
          <button
            onClick={carregarDados}
            className="p-2 rounded-xl cursor-pointer transition-all hover:bg-white/10"
            style={{ border: "1px solid rgba(99,102,241,0.2)" }}
            title="Atualizar dados"
          >
            <RefreshCw className="h-4 w-4 text-indigo-400" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={School}
          label="Turmas"
          value={turmas.length}
          sub="cadastradas"
          color="indigo"
          href="/turmas"
        />
        <StatsCard
          icon={Users}
          label="Professores"
          value={professores.length}
          sub={`${presencaPercent}% de presença`}
          color="blue"
          href="/professores"
        />
        <StatsCard
          icon={UserCheck}
          label="Presentes"
          value={professoresPresentes}
          sub={`${professoresAusentes} ausentes`}
          color="emerald"
          trend={professoresAusentes > 0 ? "down" : "up"}
          href="/professores"
        />
        <StatsCard
          icon={Activity}
          label="Aulas na Grade"
          value={totalAulas}
          sub="esta semana"
          color="purple"
          href="/grade"
        />
      </div>

      {/* Alertas rápidos se houver */}
      {(professoresAusentes > 0 || substituicoesPendentes > 0 || totalFaltasHoje > 0) && (
        <div className="flex gap-3 flex-wrap">
          {professoresAusentes > 0 && (
            <Link href="/professores">
              <AlertBadge
                icon={AlertTriangle}
                text={`${professoresAusentes} professor(es) ausente(s)`}
                type="danger"
              />
            </Link>
          )}
          {substituicoesPendentes > 0 && (
            <Link href="/substituicoes">
              <AlertBadge
                icon={RefreshCw}
                text={`${substituicoesPendentes} substituição(ões) pendente(s)`}
                type="warning"
              />
            </Link>
          )}
          {totalFaltasHoje > 0 && (
            <Link href="/faltas">
              <AlertBadge
                icon={UserCheck}
                text={`${totalFaltasHoje} falta(s) hoje`}
                type="info"
              />
            </Link>
          )}
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.2)" }}
              >
                <Activity className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Timeline da Escola</h2>
                <p className="text-xs text-indigo-400/60">Eventos em tempo real</p>
              </div>
            </div>
            <Link href="/dashboard">
              <button
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg cursor-pointer transition-all hover:bg-white/10"
                style={{ color: "rgba(129,140,248,0.7)" }}
              >
                Ver todos <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>

          <div className="space-y-3">
            {eventos.length === 0 ? (
              <div className="text-center py-10">
                <Brain className="h-12 w-12 mx-auto mb-3" style={{ color: "rgba(99,102,241,0.3)" }} />
                <p className="text-sm" style={{ color: "rgba(165,180,252,0.5)" }}>
                  Nenhum evento registrado hoje
                </p>
                <p className="text-xs mt-1" style={{ color: "rgba(165,180,252,0.3)" }}>
                  Use a ARIA para criar registros
                </p>
              </div>
            ) : (
              eventos.map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-start gap-3 rounded-xl p-3 transition-all hover:bg-white/5"
                  style={{ borderLeft: `3px solid ${getEventColor(evento.tipo)}` }}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${getEventColor(evento.tipo)}20` }}
                  >
                    <EventIcon tipo={evento.tipo} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 font-medium leading-snug">{evento.mensagem}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: "rgba(165,180,252,0.5)" }}>
                        {new Date(evento.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {evento.turma && (
                        <Badge
                          variant="outline"
                          className="text-xs py-0 h-4"
                          style={{ borderColor: "rgba(99,102,241,0.4)", color: "#A5B4FC" }}
                        >
                          {evento.turma.nome}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Painel lateral direito */}
        <div className="space-y-4">
          {/* Status rápido de professores */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(16,185,129,0.15)" }}
              >
                <Users className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Professores Hoje</h3>
                <p className="text-xs" style={{ color: "rgba(165,180,252,0.5)" }}>Situação atual</p>
              </div>
            </div>

            {/* Barra de progresso de presença */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1.5">
                <span style={{ color: "rgba(165,180,252,0.7)" }}>Presença</span>
                <span className="font-semibold text-white">{presencaPercent}%</span>
              </div>
              <div
                className="w-full rounded-full h-2"
                style={{ backgroundColor: "rgba(99,102,241,0.15)" }}
              >
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${presencaPercent}%`,
                    background:
                      presencaPercent >= 80
                        ? "linear-gradient(90deg, #10B981, #059669)"
                        : presencaPercent >= 60
                        ? "linear-gradient(90deg, #F59E0B, #D97706)"
                        : "linear-gradient(90deg, #EF4444, #DC2626)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}
              >
                <p className="text-2xl font-bold text-emerald-400">{professoresPresentes}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(110,231,183,0.7)" }}>Presentes</p>
              </div>
              <div
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <p className="text-2xl font-bold text-red-400">{professoresAusentes}</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(252,165,165,0.7)" }}>Ausentes</p>
              </div>
            </div>

            <Link href="/professores" className="block mt-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10"
              >
                Ver todos
              </Button>
            </Link>
          </div>

          {/* Links rápidos */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Acesso Rápido</h3>
            <div className="space-y-2">
              <QuickLink
                href="/grade"
                icon={Calendar}
                label="Grade Horária"
                sub={`${totalAulas} aulas`}
                color="indigo"
              />
              {mostraRecreio && (
                <QuickLink
                  href="/recreio"
                  icon={TreePine}
                  label="Recreio"
                  sub="Intercalado"
                  color="emerald"
                />
              )}
              <QuickLink
                href="/substituicoes"
                icon={RefreshCw}
                label="Substituições"
                sub={substituicoesPendentes > 0 ? `${substituicoesPendentes} pendentes` : "Nenhuma pendente"}
                color={substituicoesPendentes > 0 ? "yellow" : "gray"}
                badge={substituicoesPendentes > 0 ? substituicoesPendentes : undefined}
              />
              <QuickLink
                href="/planejamento"
                icon={BookOpen}
                label="Planejamento"
                sub="Semanal"
                color="purple"
              />
            </div>
          </div>

          {/* Dica da ARIA */}
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))",
              border: "1px solid rgba(99,102,241,0.25)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-300">Dica da ARIA</span>
              <span className="ml-auto">
                <Zap className="h-3 w-3 text-yellow-400" />
              </span>
            </div>
            <p className="text-xs" style={{ color: "rgba(165,180,252,0.8)" }}>
              Clique no botão roxo (💜) no canto inferior direito para falar com a ARIA. Ela pode
              gerar a grade, registrar faltas e analisar sua escola!
            </p>
          </div>
        </div>
      </div>

      {/* Turmas grid */}
      {turmas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <School className="h-5 w-5 text-indigo-400" />
              Suas Turmas
            </h2>
            <Link href="/turmas">
              <button
                className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-white/10"
                style={{
                  color: "rgba(129,140,248,0.7)",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                Ver todas <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {turmas.slice(0, 10).map((turma) => (
              <Link key={turma.id} href="/turmas">
                <div className="school-card p-4 cursor-pointer">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: getPeriodoGradient(turma.periodo) }}
                  >
                    <School className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{turma.nome}</p>
                  <p
                    className="text-xs mt-0.5 capitalize"
                    style={{ color: "rgba(165,180,252,0.6)" }}
                  >
                    {turma.periodo === "manha"
                      ? "☀️ Manhã"
                      : turma.periodo === "tarde"
                      ? "🌆 Tarde"
                      : "📚 Integral"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function getPeriodoGradient(periodo: string) {
  if (periodo === "tarde") return "linear-gradient(135deg, #F59E0B, #D97706)"
  if (periodo === "integral") return "linear-gradient(135deg, #8B5CF6, #6D28D9)"
  return "linear-gradient(135deg, #6366F1, #4F46E5)"
}

function getEventColor(tipo: string) {
  const colors: Record<string, string> = {
    inicio_aula: "#10B981",
    fim_aula: "#6B7280",
    inicio_recreio: "#10B981",
    fim_recreio: "#6B7280",
    falta: "#EF4444",
    substituicao: "#F59E0B",
    alerta: "#F59E0B",
  }
  return colors[tipo] || "#6366F1"
}

function AlertBadge({
  icon: Icon,
  text,
  type,
}: {
  icon: React.ElementType
  text: string
  type: "danger" | "warning" | "info"
}) {
  const styles = {
    danger: {
      bg: "rgba(239,68,68,0.1)",
      border: "rgba(239,68,68,0.3)",
      text: "#FCA5A5",
      icon: "#EF4444",
    },
    warning: {
      bg: "rgba(245,158,11,0.1)",
      border: "rgba(245,158,11,0.3)",
      text: "#FCD34D",
      icon: "#F59E0B",
    },
    info: {
      bg: "rgba(99,102,241,0.1)",
      border: "rgba(99,102,241,0.3)",
      text: "#A5B4FC",
      icon: "#6366F1",
    },
  }
  const s = styles[type]
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm cursor-pointer transition-all hover:scale-105"
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}
    >
      <Icon className="h-4 w-4 flex-shrink-0" style={{ color: s.icon }} />
      <span style={{ color: s.text }}>{text}</span>
    </div>
  )
}

function StatsCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  trend,
  href,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub?: string
  color: "indigo" | "blue" | "emerald" | "purple" | "red" | "yellow"
  trend?: "up" | "down"
  href?: string
}) {
  const colorMap = {
    indigo: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.3)", text: "#818CF8", gradient: "linear-gradient(135deg, #6366F1, #4F46E5)" },
    blue: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.3)", text: "#93C5FD", gradient: "linear-gradient(135deg, #3B82F6, #2563EB)" },
    emerald: { bg: "rgba(16,185,129,0.15)", border: "rgba(16,185,129,0.3)", text: "#6EE7B7", gradient: "linear-gradient(135deg, #10B981, #059669)" },
    purple: { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.3)", text: "#C4B5FD", gradient: "linear-gradient(135deg, #8B5CF6, #6D28D9)" },
    red: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.3)", text: "#FCA5A5", gradient: "linear-gradient(135deg, #EF4444, #DC2626)" },
    yellow: { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.3)", text: "#FCD34D", gradient: "linear-gradient(135deg, #F59E0B, #D97706)" },
  }
  const c = colorMap[color]

  const card = (
    <div
      className="school-card p-5 cursor-pointer"
      style={{ background: c.bg, borderColor: c.border }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: c.gradient }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        {trend && (
          <span
            className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full"
            style={
              trend === "up"
                ? { backgroundColor: "rgba(16,185,129,0.15)", color: "#6EE7B7" }
                : { backgroundColor: "rgba(239,68,68,0.15)", color: "#FCA5A5" }
            }
          >
            {trend === "up" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className="text-sm font-medium mt-0.5" style={{ color: c.text }}>{label}</p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "rgba(165,180,252,0.5)" }}>
          {sub}
        </p>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{card}</Link>
  }
  return card
}

function QuickLink({
  href,
  icon: Icon,
  label,
  sub,
  color,
  badge,
}: {
  href: string
  icon: React.ElementType
  label: string
  sub: string
  color: string
  badge?: number
}) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "rgba(99,102,241,0.15)", text: "#818CF8" },
    emerald: { bg: "rgba(16,185,129,0.15)", text: "#6EE7B7" },
    yellow: { bg: "rgba(245,158,11,0.15)", text: "#FCD34D" },
    purple: { bg: "rgba(139,92,246,0.15)", text: "#C4B5FD" },
    gray: { bg: "rgba(107,114,128,0.15)", text: "#9CA3AF" },
  }
  const c = colorMap[color] || colorMap.gray

  return (
    <Link href={href}>
      <div
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-all hover:bg-white/5"
        style={{ border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: c.bg }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: c.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs" style={{ color: "rgba(165,180,252,0.5)" }}>{sub}</p>
        </div>
        {badge ? (
          <span
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: "rgba(245,158,11,0.3)", color: "#FCD34D" }}
          >
            {badge}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(99,102,241,0.4)" }} />
        )}
      </div>
    </Link>
  )
}

function EventIcon({ tipo }: { tipo: string }) {
  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    inicio_aula: { icon: BookOpen, color: "#10B981" },
    fim_aula: { icon: BookOpen, color: "#6B7280" },
    inicio_recreio: { icon: TreePine, color: "#10B981" },
    fim_recreio: { icon: TreePine, color: "#6B7280" },
    falta: { icon: AlertTriangle, color: "#EF4444" },
    substituicao: { icon: RefreshCw, color: "#F59E0B" },
    alerta: { icon: AlertTriangle, color: "#F59E0B" },
  }
  const config = icons[tipo] || { icon: Activity, color: "#6366F1" }
  const Icon = config.icon
  return <Icon className="h-3.5 w-3.5" style={{ color: config.color }} />
}
