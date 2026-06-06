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
import { Plus, Pencil, Trash2, Users, Brain, BookOpen, UserX } from "lucide-react"
import { useToast } from "@/components/shared/toast"
import { useEscola } from "@/lib/escola-context"
import Link from "next/link"
import type { Professor, Monitor } from "@/types/database"

export default function EquipePage() {
  return (
    <AppShell>
      <EquipeContent />
    </AppShell>
  )
}

type Tab = "professores" | "monitores"

function EquipeContent() {
  const { tipo } = useEscola()
  const isCreche = tipo === "creche"
  const [activeTab, setActiveTab] = useState<Tab>("professores")

  const tabs = [
    { key: "professores" as const, label: "Professores / Educadores", icon: BookOpen },
    ...(isCreche ? [{ key: "monitores" as const, label: "Monitores / Auxiliares", icon: Users }] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Equipe</h1>
        <p className="text-sm mt-1 opacity-70">Professores e (para creche) monitores/auxiliares de recreio. Tudo em um lugar só.</p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2" style={{ borderColor: "var(--aria-border)" }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = activeTab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-blue-500/15 text-blue-200 border border-blue-500/30" : "hover:bg-white/5 text-white/70"}`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {activeTab === "professores" && <ProfessoresTab isCreche={isCreche} />}
      {activeTab === "monitores" && isCreche && <MonitoresTab />}
    </div>
  )
}

// ==================== PROFESSORES ====================
function ProfessoresTab({ isCreche }: { isCreche: boolean }) {
  const supabase = createClient()
  const { showToast } = useToast()
  const [professores, setProfessores] = useState<Professor[]>([])
  const [responsabilityMap, setResponsabilityMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: "", email: "", telefone: "", especialidades: "", status: "presente" as Professor["status"], carga_horaria: 20,
  })

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)
    const res = await supabase.from("professores").select("*").eq("escola_id", eId).order("nome")
    if (res.data) {
      setProfessores(res.data as any)
      if (isCreche) {
        const { data: turmasResp } = await supabase
          .from("turmas")
          .select("nome, professor_responsavel_id")
          .eq("escola_id", eId)
          .not("professor_responsavel_id", "is", null)
        const map: Record<string, string[]> = {}
        turmasResp?.forEach((t: any) => {
          if (t.professor_responsavel_id) {
            if (!map[t.professor_responsavel_id]) map[t.professor_responsavel_id] = []
            map[t.professor_responsavel_id].push(t.nome)
          }
        })
        setResponsabilityMap(map)
      }
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    const payload = {
      escola_id: eId,
      nome: form.nome,
      email: form.email || null,
      telefone: form.telefone,
      especialidades: form.especialidades ? form.especialidades.split(",").map(s => s.trim()).filter(Boolean) : [],
      status: form.status,
      carga_horaria: form.carga_horaria,
    }

    if (editingId) {
      await supabase.from("professores").update(payload).eq("id", editingId)
    } else {
      await supabase.from("professores").insert(payload)
    }
    showToast("Professor salvo", "success")
    resetForm()
    carregar()
  }

  function editProf(p: Professor) {
    setForm({
      nome: p.nome, email: p.email || "", telefone: p.telefone || "", especialidades: p.especialidades.join(", "),
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

  async function remover(id: string, nome: string) {
    if (!confirm(`Excluir ${nome}?`)) return
    await supabase.from("professores").delete().eq("id", id)
    showToast("Removido", "success")
    carregar()
  }

  const statusVariant = (s: string) => s === "presente" ? "success" : "warning"

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="font-medium">Professores / Educadores</div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={salvar} className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="md:col-span-2"><Label>Nome completo</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label>Carga horária (h/semana)</Label><Input type="number" value={form.carga_horaria} onChange={e => setForm({ ...form, carga_horaria: Number(e.target.value) })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
                  <option value="presente">Presente</option><option value="ausente">Ausente</option>
                  <option value="ferias">Férias</option><option value="licenca">Licença</option><option value="atestado">Atestado</option>
                </Select>
              </div>
              <div className="md:col-span-2"><Label>{isCreche ? "Formação / Ênfase no infantil (separado por vírgula)" : "Especialidades (separadas por vírgula)"}</Label><Input value={form.especialidades} onChange={e => setForm({ ...form, especialidades: e.target.value })} placeholder={isCreche ? "Educação Infantil, Ludicidade, Acolhimento, BNCC Infantil" : "Matemática, Português, ..."} /></div>
              <div className="md:col-span-2 flex gap-2">
                <Button type="submit">{editingId ? "Atualizar" : "Cadastrar"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {professores.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-10 w-10" />} title="Nenhum professor cadastrado" />
      ) : (
        <div className="divide-y text-sm rounded border" style={{ borderColor: "var(--aria-border)" }}>
          {professores.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 hover:bg-white/5">
              <div>
                <div className="font-medium">{p.nome}</div>
                <div className="flex gap-1 mt-0.5 flex-wrap">
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  {p.especialidades.map((e, i) => <Badge key={i} variant="outline" className="text-xs">{e}</Badge>)}
                </div>
                <div className="text-xs opacity-60 mt-0.5">{p.email} • {p.carga_horaria}h/sem</div>
                {isCreche && responsabilityMap[p.id]?.length > 0 && (
                  <div className="text-[10px] mt-1 text-emerald-600">Padrão de: {responsabilityMap[p.id].join(", ")}</div>
                )}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => editProf(p)}><Pencil className="h-4 w-4" /></Button>
                <Link href="/ausencias" title="Registrar falta/ausência (sugestões automáticas baseadas no padrão desta sala)">
                  <Button variant="ghost" size="sm"><UserX className="h-4 w-4 text-amber-400" /></Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("aria:abrir-chat"))}><Brain className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => remover(p.id, p.nome)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ==================== MONITORES (só creche) ====================
function MonitoresTab() {
  const supabase = createClient()
  const { showToast } = useToast()
  const [monitores, setMonitores] = useState<Monitor[]>([])
  const [responsabilityMap, setResponsabilityMap] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState("")
  const [tel, setTel] = useState("")

  const carregar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) { setLoading(false); return }
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)
    const res = await supabase.from("monitores").select("*").eq("escola_id", eId).order("nome")
    if (res.data) {
      setMonitores(res.data as any)
      const { data: turmasResp } = await supabase
        .from("turmas")
        .select("nome, monitor_responsavel_id")
        .eq("escola_id", eId)
        .not("monitor_responsavel_id", "is", null)
      const map: Record<string, string[]> = {}
      turmasResp?.forEach((t: any) => {
        if (t.monitor_responsavel_id) {
          if (!map[t.monitor_responsavel_id]) map[t.monitor_responsavel_id] = []
          map[t.monitor_responsavel_id].push(t.nome)
        }
      })
      setResponsabilityMap(map)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { carregar() }, [carregar])

  async function adicionar() {
    if (!nome.trim()) return
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    const { getCurrentEscolaId } = await import("@/lib/get-escola-client")
    const eId = await getCurrentEscolaId(userData.user.id)

    await supabase.from("monitores").insert({ escola_id: eId, nome: nome.trim(), telefone: tel.trim() || null })
    showToast("Monitor adicionado", "success")
    setNome(""); setTel("")
    carregar()
  }

  async function remover(id: string) {
    if (!confirm("Remover monitor?")) return
    await supabase.from("monitores").delete().eq("id", id)
    showToast("Removido", "success")
    carregar()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <div className="font-medium">Monitores / Auxiliares (usados no recreio escalonado)</div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Nome do monitor" value={nome} onChange={e => setNome(e.target.value)} className="w-64" />
        <Input placeholder="Telefone (opcional)" value={tel} onChange={e => setTel(e.target.value)} className="w-48" />
        <Button onClick={adicionar} disabled={!nome.trim()}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
      </div>

      {monitores.length === 0 ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Nenhum monitor cadastrado" description="Cadastre aqui os auxiliares que ajudam na supervisão de recreio." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {monitores.map(m => (
            <div key={m.id} className="flex items-center justify-between border rounded p-3" style={{ borderColor: "var(--aria-border)" }}>
              <div>
                <div className="font-medium">{m.nome}</div>
                {m.telefone && <div className="text-xs opacity-60">{m.telefone}</div>}
                {responsabilityMap[m.id]?.length > 0 && (
                  <div className="text-[10px] mt-1 text-emerald-600">Padrão de: {responsabilityMap[m.id].join(", ")}</div>
                )}
              </div>
              <div className="flex gap-1">
                <Link href="/ausencias" title="Registrar ausência de monitor (aplica cobertura no recreio)">
                  <Button variant="ghost" size="sm"><UserX className="h-4 w-4 text-amber-400" /></Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => remover(m.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs opacity-60">Os monitores aparecem como opção ao atribuir recreio escalonado para as turmas.</div>
    </div>
  )
}
