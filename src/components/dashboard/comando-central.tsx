"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@/lib/chat-context"
import { createClient } from "@/lib/supabase/client"
import { persistGradeHorarios, persistRecreioIntercalado } from "@/lib/persist-ia"
import { Bot, Send, X, Loader2, Paperclip, Trash2 } from "lucide-react"

function nomeRelacao(rel: unknown): string {
  if (!rel) return "?"
  if (Array.isArray(rel)) return (rel[0] as { nome?: string })?.nome || "?"
  return (rel as { nome?: string }).nome || "?"
}

export function ComandoCentral() {
  const { mensagens, addMensagem, limpar } = useChat()
  const [aberto, setAberto] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [anexo, setAnexo] = useState<File | null>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [mensagens])

  async function garantirEscola(escolaId: string) {
    const { data: existing } = await supabase.from("escolas").select("id").eq("id", escolaId).maybeSingle()
    if (!existing) {
      const { error } = await supabase.from("escolas").insert({ id: escolaId, nome: "Minha Escola" })
      if (error && error.code !== "23505") throw error
    }
  }

  async function executarAcao(acao: string, params: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, mensagem: "Usuário não autenticado" }
    const escolaId = user.id

    try {
      await garantirEscola(escolaId)
    } catch {
      return { ok: false, mensagem: "Erro ao garantir escola no banco" }
    }

    switch (acao) {
      case "criar_turma": {
        let serieId = params.serie_id
        if (!serieId) {
          const { data: series } = await supabase.from("series").select("id, nome").eq("escola_id", escolaId)
          const match = series?.find((s) => params.nome.toLowerCase().includes(s.nome.toLowerCase()))
          if (match) serieId = match.id
        }
        const { data, error } = await supabase.from("turmas").insert({
          escola_id: escolaId, nome: params.nome, serie_id: serieId || null, periodo: params.periodo || "manha",
        }).select()
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Turma "${params.nome}" criada!`, dados: data?.[0] }
      }
      case "criar_professor": {
        const { data, error } = await supabase.from("professores").insert({
          escola_id: escolaId, nome: params.nome,
          email: params.email || `${params.nome.toLowerCase().replace(/\s/g, ".")}@escola.com`,
          especialidades: params.especialidades || [], carga_horaria: params.carga_horaria || 20,
        }).select()
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Professor(a) "${params.nome}" cadastrado(a)!`, dados: data?.[0] }
      }
      case "criar_materia": {
        const { data, error } = await supabase.from("materias").insert({
          escola_id: escolaId, nome: params.nome, cor: params.cor || "#3B82F6",
        }).select()
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Matéria "${params.nome}" criada!`, dados: data?.[0] }
      }
      case "registrar_falta": {
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${params.professor_nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${params.professor_nome}" não encontrado` }
        const prof = profs[0]
        await supabase.from("professores").update({ status: "ausente" }).eq("id", prof.id)
        await supabase.from("faltas").insert({
          escola_id: escolaId, professor_id: prof.id,
          data: new Date().toISOString().split("T")[0], motivo: params.motivo || "Não informado", status: "justificada",
        })
        await supabase.from("eventos_tempo_real").insert({
          escola_id: escolaId, tipo: "falta",
          mensagem: `${prof.nome} registrou falta: ${params.motivo || "Não informado"}`,
          professor_id: prof.id,
        })
        // Auto-substituto
        let msg = `Falta registrada para ${prof.nome}!`
        const { data: disponiveis } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).eq("status", "presente")
        const substituto = disponiveis?.find((p) => p.id !== prof.id)
        if (substituto) {
          await supabase.from("substituicoes").insert({
            escola_id: escolaId, professor_original_id: prof.id,
            professor_substituto_id: substituto.id, data: new Date().toISOString().split("T")[0], status: "pendente",
          })
          await supabase.from("eventos_tempo_real").insert({
            escola_id: escolaId, tipo: "substituicao",
            mensagem: `${substituto.nome} substituindo ${prof.nome}`,
          })
          msg += `\n\nSubstituição automática: ${substituto.nome} foi designado(a) como substituto(a)!`
        }
        return { ok: true, mensagem: msg }
      }
      case "listar_professores": {
        const { data } = await supabase.from("professores").select("nome, especialidades, status, carga_horaria").eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Nenhum professor cadastrado." }
        const lista = data.map((p) => `${p.nome} (${p.status}) - ${(p.especialidades||[]).join(", ") || "sem especialidades"} - ${p.carga_horaria}h`).join("\n")
        return { ok: true, mensagem: `**Professores (${data.length}):**\n${lista}` }
      }
      case "listar_turmas": {
        const { data } = await supabase.from("turmas").select("nome, periodo").eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma turma cadastrada." }
        return { ok: true, mensagem: `**Turmas (${data.length}):**\n${data.map((t) => `${t.nome} (${t.periodo})`).join("\n")}` }
      }
      case "listar_materias": {
        const { data } = await supabase.from("materias").select("nome").eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma matéria cadastrada." }
        return { ok: true, mensagem: `**Matérias (${data.length}):**\n${data.map((m) => m.nome).join("\n")}` }
      }
      case "status_sistema": {
        const [tRes, pRes, mRes, sRes] = await Promise.all([
          supabase.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("professores").select("id,status").eq("escola_id", escolaId),
          supabase.from("materias").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("series").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
        ])
        const presentes = pRes.data?.filter((p) => p.status === "presente").length || 0
        const ausentes = pRes.data?.filter((p) => p.status !== "presente").length || 0
        return {
          ok: true,
          mensagem: `**Status da Escola**\n\nTurmas: ${tRes.count || 0}\nProfessores: ${pRes.data?.length || 0} (${presentes} presentes, ${ausentes} ausentes)\nMatérias: ${mRes.count || 0}\nSéries: ${sRes.count || 0}`,
        }
      }
      case "editar_professor": {
        const busca = params.busca || params.nome
        const { data: profs } = await supabase.from("professores").select("*").eq("escola_id", escolaId).ilike("nome", `%${busca}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${busca}" não encontrado` }
        const prof = profs[0]
        const updates: any = {}
        if (params.nome) updates.nome = params.nome
        if (params.email) updates.email = params.email
        if (params.telefone) updates.telefone = params.telefone
        if (params.especialidades) updates.especialidades = params.especialidades
        if (params.carga_horaria) updates.carga_horaria = params.carga_horaria
        if (params.status) updates.status = params.status
        if (Object.keys(updates).length === 0) {
          return { ok: false, mensagem: "Nenhum campo para atualizar. Ex: 'mude o email do NOME para novo@email.com'" }
        }
        const { error } = await supabase.from("professores").update(updates).eq("id", prof.id)
        if (error) return { ok: false, mensagem: `Erro ao editar: ${error.message}` }
        const campos = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ")
        return { ok: true, mensagem: `Professor "${prof.nome}" atualizado!\n${campos}` }
      }
      case "editar_turma": {
        const busca = params.busca || params.nome
        const { data: turmas } = await supabase.from("turmas").select("*").eq("escola_id", escolaId).ilike("nome", `%${busca}%`)
        if (!turmas?.length) return { ok: false, mensagem: `Turma "${busca}" não encontrada` }
        const turma = turmas[0]
        const updates: any = {}
        if (params.nome) updates.nome = params.nome
        if (params.periodo) updates.periodo = params.periodo
        if (params.serie_id) updates.serie_id = params.serie_id
        if (Object.keys(updates).length === 0) return { ok: false, mensagem: "Nenhum campo para atualizar" }
        const { error } = await supabase.from("turmas").update(updates).eq("id", turma.id)
        if (error) return { ok: false, mensagem: `Erro ao editar: ${error.message}` }
        return { ok: true, mensagem: `Turma "${turma.nome}" atualizada!` }
      }
      case "editar_materia": {
        const busca = params.busca || params.nome
        const { data: materias } = await supabase.from("materias").select("*").eq("escola_id", escolaId).ilike("nome", `%${busca}%`)
        if (!materias?.length) return { ok: false, mensagem: `Matéria "${busca}" não encontrada` }
        const materia = materias[0]
        const updates: any = {}
        if (params.nome) updates.nome = params.nome
        if (params.cor) updates.cor = params.cor
        if (Object.keys(updates).length === 0) return { ok: false, mensagem: "Nenhum campo para atualizar" }
        const { error } = await supabase.from("materias").update(updates).eq("id", materia.id)
        if (error) return { ok: false, mensagem: `Erro ao editar: ${error.message}` }
        return { ok: true, mensagem: `Matéria "${materia.nome}" atualizada!` }
      }
      case "deletar_professor": {
        const nome = params.nome || params.busca
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        await supabase.from("professores").delete().eq("id", profs[0].id)
        return { ok: true, mensagem: `Professor "${profs[0].nome}" removido!` }
      }
      case "deletar_turma": {
        const nome = params.nome || params.busca
        const { data: turmas } = await supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!turmas?.length) return { ok: false, mensagem: `Turma "${nome}" não encontrada` }
        await supabase.from("turmas").delete().eq("id", turmas[0].id)
        return { ok: true, mensagem: `Turma "${turmas[0].nome}" removida!` }
      }
      case "deletar_materia": {
        const nome = params.nome || params.busca
        const { data: materias } = await supabase.from("materias").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!materias?.length) return { ok: false, mensagem: `Matéria "${nome}" não encontrada` }
        await supabase.from("materias").delete().eq("id", materias[0].id)
        return { ok: true, mensagem: `Matéria "${materias[0].nome}" removida!` }
      }
      case "detalhes_professor": {
        const nome = params.nome || params.busca
        const { data: profs } = await supabase.from("professores").select("*").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const p = profs[0]
        return {
          ok: true,
          mensagem: `**${p.nome}**\n- Email: ${p.email || "não informado"}\n- Telefone: ${p.telefone || "não informado"}\n- Especialidades: ${(p.especialidades||[]).join(", ") || "nenhuma"}\n- Carga Horária: ${p.carga_horaria}h\n- Status: ${p.status}`,
        }
      }

      // ===== PERIODOS =====
      case "criar_periodo": {
        const tipo = params.tipo || "aula"
        const { data: existing } = await supabase.from("periodos").select("ordem").eq("escola_id", escolaId).order("ordem", { ascending: false }).limit(1)
        const ordem = params.ordem || (existing?.[0]?.ordem ?? 0) + 1
        const hora_inicio = params.hora_inicio || params.inicio || params.horario_inicio || "08:00"
        const hora_fim = params.hora_fim || params.fim || params.horario_fim || "09:00"
        const { data, error } = await supabase.from("periodos").insert({
          escola_id: escolaId, nome: params.nome, tipo, ordem, hora_inicio, hora_fim,
        }).select()
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Período "${params.nome}" criado!`, dados: data?.[0] }
      }
      case "listar_periodos": {
        const { data } = await supabase.from("periodos").select("*").eq("escola_id", escolaId).order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhum período cadastrado." }
        const lista = data.map((p) => `${p.nome} (${p.tipo}) - ${p.hora_inicio} às ${p.hora_fim}`).join("\n")
        return { ok: true, mensagem: `**Períodos (${data.length}):**\n${lista}` }
      }
      case "editar_periodo": {
        const busca = params.busca || params.nome
        const { data: periodos } = await supabase.from("periodos").select("*").eq("escola_id", escolaId).ilike("nome", `%${busca}%`)
        if (!periodos?.length) return { ok: false, mensagem: `Período "${busca}" não encontrado` }
        const periodo = periodos[0]
        const updates: any = {}
        if (params.nome) updates.nome = params.nome
        if (params.tipo) updates.tipo = params.tipo
        if (params.hora_inicio) updates.hora_inicio = params.hora_inicio
        if (params.hora_fim) updates.hora_fim = params.hora_fim
        if (params.ordem) updates.ordem = params.ordem
        if (Object.keys(updates).length === 0) return { ok: false, mensagem: "Nenhum campo para atualizar" }
        const { error } = await supabase.from("periodos").update(updates).eq("id", periodo.id)
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Período "${periodo.nome}" atualizado!` }
      }
      case "deletar_periodo": {
        const nome = params.nome || params.busca
        const { data: periodos } = await supabase.from("periodos").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!periodos?.length) return { ok: false, mensagem: `Período "${nome}" não encontrado` }
        await supabase.from("periodos").delete().eq("id", periodos[0].id)
        return { ok: true, mensagem: `Período "${periodos[0].nome}" removido!` }
      }

      // ===== SERIES =====
      case "criar_serie": {
        const { data: existing } = await supabase.from("series").select("ordem").eq("escola_id", escolaId).order("ordem", { ascending: false }).limit(1)
        const ordem = params.ordem || (existing?.[0]?.ordem ?? 0) + 1
        const { data, error } = await supabase.from("series").insert({
          escola_id: escolaId, nome: params.nome, ordem,
        }).select()
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Série "${params.nome}" criada!` }
      }
      case "editar_serie": {
        const busca = params.busca || params.nome
        const { data: series } = await supabase.from("series").select("*").eq("escola_id", escolaId).ilike("nome", `%${busca}%`)
        if (!series?.length) return { ok: false, mensagem: `Série "${busca}" não encontrada` }
        const serie = series[0]; const updates: any = {}
        if (params.nome) updates.nome = params.nome
        if (params.ordem) updates.ordem = params.ordem
        if (!Object.keys(updates).length) return { ok: false, mensagem: "Nenhum campo para atualizar" }
        await supabase.from("series").update(updates).eq("id", serie.id)
        return { ok: true, mensagem: `Série "${serie.nome}" atualizada!` }
      }
      case "deletar_serie": {
        const nome = params.nome || params.busca
        const { data: series } = await supabase.from("series").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!series?.length) return { ok: false, mensagem: `Série "${nome}" não encontrada` }
        await supabase.from("series").delete().eq("id", series[0].id)
        return { ok: true, mensagem: `Série "${series[0].nome}" removida!` }
      }
      case "listar_series": {
        const { data } = await supabase.from("series").select("*").eq("escola_id", escolaId).order("ordem")
        if (!data?.length) return { ok: true, mensagem: "Nenhuma série cadastrada." }
        return { ok: true, mensagem: `**Séries:**\n${data.map((s) => `${s.nome} (ordem ${s.ordem})`).join("\n")}` }
      }

      // ===== PROFESSOR ENHANCEMENTS =====
      case "alterar_status_professor": {
        const nome = params.nome || params.busca
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const status = (params.status || "presente").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const statusMap: any = { presente: "presente", ausente: "ausente", ferias: "ferias", licenca: "licenca", atestado: "atestado" }
        await supabase.from("professores").update({ status: statusMap[status] || "presente" }).eq("id", profs[0].id)
        return { ok: true, mensagem: `Status de "${profs[0].nome}" alterado para ${status}!` }
      }
      case "listar_disponiveis": {
        const { data } = await supabase.from("professores").select("nome, especialidades").eq("escola_id", escolaId).eq("status", "presente")
        if (!data?.length) return { ok: true, mensagem: "Nenhum professor disponível no momento." }
        const lista = data.map((p) => `${p.nome} (${(p.especialidades||[]).join(", ") || "geral"})`).join("\n")
        return { ok: true, mensagem: `**Disponíveis (${data.length}):**\n${lista}` }
      }
      case "professores_por_especialidade": {
        const esp = (params.especialidade || params.nome || "").toLowerCase()
        const { data } = await supabase.from("professores").select("nome, especialidades, status").eq("escola_id", escolaId)
        const filtrados = esp ? data?.filter((p) => p.especialidades?.some((e: string) => e.toLowerCase().includes(esp))) : data
        if (!filtrados?.length) return { ok: true, mensagem: esp ? `Nenhum professor com especialidade "${esp}"` : "Nenhum professor cadastrado." }
        return { ok: true, mensagem: `**${esp ? `Professores de ${esp}` : "Todos os professores"} (${filtrados.length}):**\n${filtrados.map((p) => `${p.nome} - ${p.status} [${(p.especialidades||[]).join(", ")}]`).join("\n")}` }
      }
      case "turmas_sem_professor": {
        const { data: grade } = await supabase.from("grade_horarios").select("turma_id").eq("escola_id", escolaId)
        const { data: turmas } = await supabase.from("turmas").select("id, nome").eq("escola_id", escolaId)
        const comAula = new Set(grade?.map((g) => g.turma_id) || [])
        const sem = turmas?.filter((t) => !comAula.has(t.id)) || []
        if (!sem.length) return { ok: true, mensagem: "Todas as turmas têm aulas na grade!" }
        return { ok: true, mensagem: `**Turmas sem aula na grade (${sem.length}):**\n${sem.map((t) => t.nome).join("\n")}` }
      }

      // ===== FALTAS =====
      case "listar_faltas": {
        const { data } = await supabase.from("faltas").select("*, professor:professores(nome)").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma falta registrada." }
        return { ok: true, mensagem: `**Últimas Faltas:**\n${data.map((f) => `${nomeRelacao(f.professor)} - ${f.data} - ${f.motivo} (${f.status})`).join("\n")}` }
      }
      case "deletar_falta": {
        const nome = params.professor_nome || params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const { data: faltas } = await supabase.from("faltas").select("id").eq("escola_id", escolaId).eq("professor_id", profs[0].id).order("created_at", { ascending: false }).limit(1)
        if (!faltas?.length) return { ok: false, mensagem: `Nenhuma falta encontrada para "${profs[0].nome}"` }
        await supabase.from("faltas").delete().eq("id", faltas[0].id)
        return { ok: true, mensagem: `Falta de ${profs[0].nome} removida!` }
      }
      case "justificar_falta": {
        const nome = params.professor_nome || params.nome || params.busca
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const { data: faltas } = await supabase.from("faltas").select("id").eq("escola_id", escolaId).eq("professor_id", profs[0].id).eq("status", "injustificada").limit(1)
        if (!faltas?.length) return { ok: false, mensagem: `Nenhuma falta injustificada para "${profs[0].nome}"` }
        await supabase.from("faltas").update({ status: "justificada", motivo: params.motivo || "Justificado via IA" }).eq("id", faltas[0].id)
        return { ok: true, mensagem: `Falta de ${profs[0].nome} justificada!` }
      }
      case "faltas_do_professor": {
        const nome = params.nome || params.busca || params.professor_nome
        if (!nome) return { ok: false, mensagem: "Informe o nome do professor." }
        const { data: profs } = await supabase.from("professores").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
        if (!profs?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const { data: faltas } = await supabase.from("faltas").select("data, motivo, status").eq("escola_id", escolaId).eq("professor_id", profs[0].id).order("data", { ascending: false })
        if (!faltas?.length) return { ok: true, mensagem: `Nenhuma falta para "${profs[0].nome}"` }
        return { ok: true, mensagem: `**Faltas de ${profs[0].nome}:**\n${faltas.map((f) => `${f.data} - ${f.motivo} (${f.status})`).join("\n")}` }
      }
      case "professor_mais_faltas": {
        const { data } = await supabase.from("faltas").select("professor_id, professor:professores(nome)").eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma falta registrada." }
        const contagem: Record<string, { nome: string, count: number }> = {}
        for (const f of data) {
          const key = f.professor_id
          const prof = f.professor as { nome?: string } | { nome?: string }[] | null
          const nomeProf = Array.isArray(prof) ? prof[0]?.nome : prof?.nome
          if (!contagem[key]) contagem[key] = { nome: nomeProf || "?", count: 0 }
          contagem[key].count++
        }
        const ranking = Object.values(contagem).sort((a, b) => b.count - a.count).slice(0, 5)
        return { ok: true, mensagem: `**Ranking de Faltas:**\n${ranking.map((r, i) => `${i+1}. ${r.nome} - ${r.count} falta(s)`).join("\n")}` }
      }

      // ===== SUBSTITUICOES =====
      case "listar_substituicoes": {
        const { data } = await supabase.from("substituicoes").select("*, professor_original:professores!professor_original_id(nome), professor_substituto:professores!professor_substituto_id(nome)").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição registrada." }
        return { ok: true, mensagem: `**Substituições:**\n${data.map((s) => `${nomeRelacao(s.professor_original)} → ${nomeRelacao(s.professor_substituto)} (${s.data}) - ${s.status}`).join("\n")}` }
      }
      case "sugerir_substituto": {
        const nome = params.professor_nome || params.nome || params.busca
        const { data: profs } = await supabase.from("professores").select("id, nome, especialidades").eq("escola_id", escolaId).eq("status", "presente")
        if (!profs?.length) return { ok: true, mensagem: "Nenhum professor disponível para substituição." }
        if (!nome) return { ok: true, mensagem: `**Disponíveis para substituir:**\n${profs.map((p) => `${p.nome} (${(p.especialidades||[]).join(", ") || "geral"})`).join("\n")}` }
        const { data: ausente } = await supabase.from("professores").select("id, nome, especialidades").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
        if (!ausente?.length) return { ok: false, mensagem: `Professor "${nome}" não encontrado` }
        const substituto = profs.find((p) => p.id !== ausente[0].id)
        if (!substituto) return { ok: false, mensagem: "Nenhum substituto disponível." }
        return { ok: true, mensagem: `Sugestão: ${substituto.nome} pode substituir ${ausente[0].nome}!` }
      }
      case "confirmar_substituicao": {
        const { data } = await supabase.from("substituicoes").select("id, professor_original:professores!professor_original_id(nome), professor_substituto:professores!professor_substituto_id(nome)").eq("escola_id", escolaId).eq("status", "pendente").limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição pendente." }
        await supabase.from("substituicoes").update({ status: "confirmada" }).eq("id", data[0].id)
        return { ok: true, mensagem: `Substituição confirmada: ${nomeRelacao(data[0].professor_substituto)} substituindo ${nomeRelacao(data[0].professor_original)}` }
      }
      case "recusar_substituicao": {
        const { data } = await supabase.from("substituicoes").select("id").eq("escola_id", escolaId).eq("status", "pendente").limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição pendente." }
        await supabase.from("substituicoes").update({ status: "recusada" }).eq("id", data[0].id)
        return { ok: true, mensagem: "Substituição recusada!" }
      }
      case "cancelar_substituicao": {
        const { data } = await supabase.from("substituicoes").select("id").eq("escola_id", escolaId).neq("status", "recusada").limit(1)
        if (!data?.length) return { ok: true, mensagem: "Nenhuma substituição ativa." }
        await supabase.from("substituicoes").update({ status: "recusada" }).eq("id", data[0].id)
        return { ok: true, mensagem: "Substituição cancelada!" }
      }

      // ===== PLANEJAMENTO =====
      case "criar_planejamento": {
        const desc = String(params.descricao || params.conteudo || params.nome || "")
        if (!desc) return { ok: false, mensagem: "Informe o conteúdo do planejamento." }

        async function resolverId(
          tabela: "turmas" | "materias" | "professores",
          idParam?: unknown,
          nomeParam?: unknown
        ) {
          if (idParam) return String(idParam)
          const nome = nomeParam ? String(nomeParam) : ""
          if (!nome) return null
          const { data } = await supabase.from(tabela).select("id").eq("escola_id", escolaId).ilike("nome", `%${nome}%`).limit(1)
          return data?.[0]?.id || null
        }

        const turmaId = await resolverId("turmas", params.turma_id, params.turma_nome || params.turma)
        const materiaId = await resolverId("materias", params.materia_id, params.materia_nome || params.materia)
        const professorId = await resolverId("professores", params.professor_id, params.professor_nome || params.professor)

        const [tFallback, mFallback, pFallback] = await Promise.all([
          turmaId ? Promise.resolve({ data: [{ id: turmaId }] }) : supabase.from("turmas").select("id").eq("escola_id", escolaId).limit(1),
          materiaId ? Promise.resolve({ data: [{ id: materiaId }] }) : supabase.from("materias").select("id").eq("escola_id", escolaId).limit(1),
          professorId ? Promise.resolve({ data: [{ id: professorId }] }) : supabase.from("professores").select("id").eq("escola_id", escolaId).limit(1),
        ])
        if (!tFallback.data?.length || !mFallback.data?.length || !pFallback.data?.length) {
          return { ok: false, mensagem: "Crie turmas, matérias e professores antes." }
        }

        const hoje = new Date()
        const dia = hoje.getDay()
        const diff = hoje.getDate() - dia + (dia === 0 ? -6 : 1)
        const segunda = new Date(hoje.setDate(diff))

        const { error } = await supabase.from("planejamento_semanal").insert({
          escola_id: escolaId,
          turma_id: tFallback.data[0].id,
          materia_id: mFallback.data[0].id,
          professor_id: pFallback.data[0].id,
          semana_inicio: segunda.toISOString().split("T")[0],
          conteudo: desc,
          objetivos: String(params.objetivos || desc),
        })
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Planejamento criado: "${desc.substring(0, 50)}"` }
      }
      case "editar_planejamento": {
        const { data } = await supabase.from("planejamento_semanal").select("id, conteudo").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(1)
        if (!data?.length) return { ok: false, mensagem: "Nenhum planejamento encontrado." }
        await supabase.from("planejamento_semanal").update({
          conteudo: params.conteudo || params.descricao || params.nome,
          objetivos: params.objetivos || params.conteudo || params.nome,
        }).eq("id", data[0].id)
        return { ok: true, mensagem: "Planejamento atualizado!" }
      }
      case "deletar_planejamento": {
        const { data } = await supabase.from("planejamento_semanal").select("id").eq("escola_id", escolaId).limit(1)
        if (!data?.length) return { ok: false, mensagem: "Nenhum planejamento para deletar." }
        await supabase.from("planejamento_semanal").delete().eq("id", data[0].id)
        return { ok: true, mensagem: "Planejamento removido!" }
      }
      case "listar_planejamentos": {
        const { data } = await supabase.from("planejamento_semanal").select("*, turma:turmas(nome), materia:materias(nome), professor:professores(nome)").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhum planejamento cadastrado." }
        return { ok: true, mensagem: `**Planejamentos:**\n${data.map((p) => `${nomeRelacao(p.turma)} - ${nomeRelacao(p.materia)} - ${p.conteudo?.substring(0, 40)}`).join("\n")}` }
      }

      // ===== GRADE HORARIA =====
      case "gerar_grade": {
        try {
          const [tRes, mRes, pRes, perRes, gRes] = await Promise.all([
            supabase.from("turmas").select("id, nome").eq("escola_id", escolaId),
            supabase.from("materias").select("id, nome").eq("escola_id", escolaId),
            supabase.from("professores").select("id, nome, especialidades, carga_horaria").eq("escola_id", escolaId),
            supabase.from("periodos").select("*").eq("escola_id", escolaId).order("ordem"),
            supabase.from("grade_horarios").select("*, materia:materias(nome), professor:professores(nome)").eq("escola_id", escolaId),
          ])
          if (!tRes.data?.length || !mRes.data?.length || !pRes.data?.length || !perRes.data?.length) {
            return { ok: false, mensagem: "Crie turmas, matérias, professores e períodos primeiro." }
          }
          const apiRes = await fetch("/api/ia/gerar-grade", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turmas: tRes.data, materias: mRes.data, professores: pRes.data, periodos: perRes.data, gradeAtual: gRes.data || [] }),
          })
          const payload = await apiRes.json()
          if (!apiRes.ok) return { ok: false, mensagem: payload.error || `IA grade: ${apiRes.status}` }
          return await persistGradeHorarios(supabase, escolaId, payload, tRes.data, mRes.data, pRes.data, perRes.data)
        } catch (e) {
          return { ok: false, mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}` }
        }
      }
      case "limpar_grade": {
        await supabase.from("grade_horarios").delete().eq("escola_id", escolaId)
        return { ok: true, mensagem: "Grade horária limpa!" }
      }
      case "listar_grade_turma": {
        const busca = params.nome || params.busca || params.turma_nome
        const { data: turmas } = busca
          ? await supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).ilike("nome", `%${busca}%`).limit(1)
          : await supabase.from("turmas").select("id, nome").eq("escola_id", escolaId).limit(1)
        if (!turmas?.length) return { ok: false, mensagem: "Nenhuma turma encontrada." }
        const { data } = await supabase.from("grade_horarios").select("dia_semana, materia:materias(nome), professor:professores(nome), periodo:periodos(nome, hora_inicio)").eq("escola_id", escolaId).eq("turma_id", turmas[0].id).order("dia_semana")
        if (!data?.length) return { ok: true, mensagem: `Grade vazia para "${turmas[0].nome}".` }
        const dias = ["Seg", "Ter", "Qua", "Qui", "Sex"]
        const linhas = data.map((a) => {
          const periodo = a.periodo as { hora_inicio?: string } | { hora_inicio?: string }[] | null
          const hora = Array.isArray(periodo) ? periodo[0]?.hora_inicio : periodo?.hora_inicio
          return `${dias[a.dia_semana]||a.dia_semana} - ${nomeRelacao(a.materia)} (${nomeRelacao(a.professor)}) ${hora || ""}`
        })
        return { ok: true, mensagem: `**Grade - ${turmas[0].nome}:**\n${linhas.join("\n")}` }
      }
      case "verificar_conflitos": {
        const { data } = await supabase.from("grade_horarios").select("professor_id, dia_semana, periodo_id, professor:professores(nome)").eq("escola_id", escolaId)
        if (!data?.length) return { ok: true, mensagem: "Grade vazia, sem conflitos." }
        const grupos: Record<string, any[]> = {}
        for (const a of data) {
          const key = `${a.professor_id}-${a.dia_semana}-${a.periodo_id}`
          if (!grupos[key]) grupos[key] = []
          grupos[key].push(a)
        }
        const conflitos = Object.values(grupos).filter((g) => g.length > 1)
        if (!conflitos.length) return { ok: true, mensagem: "Nenhum conflito encontrado na grade!" }
        const lista = conflitos.map((g) => `⚠ ${nomeRelacao(g[0].professor)} - dia ${g[0].dia_semana} (${g.length}x)`).join("\n")
        return { ok: true, mensagem: `**Conflitos encontrados (${conflitos.length}):**\n${lista}` }
      }
      case "adicionar_aula": {
        const tNome = params.turma_nome || params.turma
        const mNome = params.materia_nome || params.materia
        const pNome = params.professor_nome || params.professor
        const dia = params.dia_semana ?? 0
        const [tRes, mRes, pRes, perRes] = await Promise.all([
          supabase.from("turmas").select("id").eq("escola_id", escolaId).ilike("nome", `%${tNome||""}%`).limit(1),
          supabase.from("materias").select("id").eq("escola_id", escolaId).ilike("nome", `%${mNome||""}%`).limit(1),
          supabase.from("professores").select("id").eq("escola_id", escolaId).ilike("nome", `%${pNome||""}%`).limit(1),
          supabase.from("periodos").select("id").eq("escola_id", escolaId).order("ordem").limit(1),
        ])
        if (!tRes.data?.length || !mRes.data?.length || !pRes.data?.length || !perRes.data?.length) {
          return { ok: false, mensagem: "Turma, matéria, professor ou período não encontrado." }
        }
        const { error } = await supabase.from("grade_horarios").insert({
          escola_id: escolaId, turma_id: tRes.data[0].id, materia_id: mRes.data[0].id,
          professor_id: pRes.data[0].id, dia_semana: dia, periodo_id: perRes.data[0].id,
        })
        if (error) return { ok: false, mensagem: `Erro: ${error.message}` }
        return { ok: true, mensagem: `Aula adicionada! ${mNome || ""} - ${pNome || ""} (dia ${dia})` }
      }
      case "remover_aula": {
        const { data: grade } = await supabase.from("grade_horarios").select("id, materia:materias(nome)").eq("escola_id", escolaId).limit(1)
        if (!grade?.length) return { ok: true, mensagem: "Grade vazia." }
        await supabase.from("grade_horarios").delete().eq("id", grade[0].id)
        return { ok: true, mensagem: `Aula de ${nomeRelacao(grade[0].materia)} removida!` }
      }

      // ===== RECREIO =====
      case "gerar_recreio": {
        try {
          const { data: turmasData } = await supabase.from("turmas").select("id, nome, periodo").eq("escola_id", escolaId)
          if (!turmasData?.length) return { ok: false, mensagem: "Crie turmas primeiro." }
          const apiRes = await fetch("/api/ia/gerar-recreio", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ turmas: turmasData, espacosDisponiveis: 2, duracao: 20 }),
          })
          const payload = await apiRes.json()
          if (!apiRes.ok) return { ok: false, mensagem: payload.error || `IA recreio: ${apiRes.status}` }
          return await persistRecreioIntercalado(supabase, escolaId, payload, turmasData)
        } catch (e) {
          return { ok: false, mensagem: `Erro: ${e instanceof Error ? e.message : "desconhecido"}` }
        }
      }

      // ===== EVENTOS =====
      case "listar_eventos": {
        const { data } = await supabase.from("eventos_tempo_real").select("*, professor:professores(nome), turma:turmas(nome)").eq("escola_id", escolaId).order("created_at", { ascending: false }).limit(20)
        if (!data?.length) return { ok: true, mensagem: "Nenhum evento registrado." }
        return { ok: true, mensagem: `**Eventos:**\n${data.map((e) => `${new Date(e.created_at).toLocaleTimeString("pt-BR")} - ${e.mensagem}`).join("\n")}` }
      }

      // ===== CONSULTAS =====
      case "resumo_semanal": {
        const hoje = new Date(); const semanaAtras = new Date(hoje.getTime() - 7*86400000).toISOString().split("T")[0]
        const [tRes, pRes, fRes, sRes, eRes] = await Promise.all([
          supabase.from("turmas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId),
          supabase.from("professores").select("id,status").eq("escola_id", escolaId),
          supabase.from("faltas").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).gte("data", semanaAtras),
          supabase.from("substituicoes").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).eq("status", "pendente"),
          supabase.from("eventos_tempo_real").select("id", { count: "exact", head: true }).eq("escola_id", escolaId).gte("created_at", semanaAtras),
        ])
        const presentes = pRes.data?.filter((p) => p.status === "presente").length || 0
        const ausentes = pRes.data?.filter((p) => p.status !== "presente").length || 0
        return { ok: true, mensagem: `**Resumo Semanal**\n\n📚 Turmas: ${tRes.count || 0}\n👥 Professores: ${pRes.data?.length||0} (${presentes} ✅, ${ausentes} ❌)\n📋 Faltas (7d): ${fRes.count||0}\n🔄 Subst. pendentes: ${sRes.count||0}\n📌 Eventos (7d): ${eRes.count||0}` }
      }

      default:
        return { ok: false, mensagem: `Ação "${acao}" desconhecida` }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() && !anexo) return

    const textoUsuario = input.trim()
    setInput("")
    addMensagem({ role: "user", content: textoUsuario || `[Anexo: ${anexo?.name}]` })
    setLoading(true)

    try {
      if (anexo) {
        const formData = new FormData()
        formData.append("file", anexo)
        formData.append("professor", textoUsuario)
        const upRes = await fetch("/api/upload", { method: "POST", body: formData })
        const upData = await upRes.json().catch(() => ({}))
        if (!upRes.ok) {
          addMensagem({ role: "assistant", content: upData.error || "Erro ao enviar atestado." })
          setLoading(false)
          return
        }
        if (upData.faltaRegistrada) {
          addMensagem({ role: "assistant", content: upData.message || "Atestado enviado e falta registrada." })
        }
        setAnexo(null)
        if (!textoUsuario.trim()) {
          setLoading(false)
          return
        }
      }

      // 1. Manda pro servidor pra interpretar
      const res = await fetch("/api/ia/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comando: textoUsuario + (anexo ? ` (com atestado anexado: ${anexo.name})` : ""),
        }),
      })

      const data = await res.json()

      if (!data.acao || data.acao === "desconhecido" || data.acao === "erro") {
        addMensagem({ role: "assistant", content: data.resposta || data.mensagem || "Não entendi o comando." })
        setLoading(false)
        return
      }

      // 2. Executa a ação no CLIENTE (com a sessão correta)
      const resultado = await executarAcao(data.acao, data.params)
      const prefix = resultado.ok ? "✅ " : "❌ "
      addMensagem({ role: "assistant", content: prefix + (resultado.mensagem || "Comando executado!") })
    } catch {
      addMensagem({ role: "assistant", content: "❌ Erro ao processar comando." })
    }
    setLoading(false)
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all cursor-pointer ${aberto ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
        style={{ bottom: "24px", right: "24px", backgroundColor: "#6366F1" }}
      >
        <Bot className="h-6 w-6 text-white" />
      </button>

      <div
        className={`fixed z-50 flex w-96 flex-col rounded-2xl shadow-2xl border transition-all duration-300 ${aberto ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"}`}
        style={{ bottom: "24px", right: "24px", height: "600px", backgroundColor: "#1E1B4B", borderColor: "#4338CA" }}
      >
        <div className="flex items-center justify-between rounded-t-2xl px-4 py-3" style={{ backgroundColor: "#312E81" }}>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-300" />
            <span className="font-semibold text-white text-sm">Comando Central IA</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={limpar} className="p-1 cursor-pointer" title="Limpar conversa">
              <Trash2 className="h-4 w-4 text-indigo-300 hover:text-white" />
            </button>
            <button onClick={() => setAberto(false)} className="p-1 cursor-pointer">
              <X className="h-5 w-5 text-indigo-300 hover:text-white" />
            </button>
          </div>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto space-y-3 px-4 py-3" style={{ backgroundColor: "#1E1B4B" }}>
          {mensagens.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "rounded-br-md" : "rounded-bl-md"}`}
                style={{
                  backgroundColor: msg.role === "user" ? "#6366F1" : "#2D2A6E",
                  color: msg.role === "user" ? "white" : "#E0E0FF",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md px-4 py-2.5 text-sm" style={{ backgroundColor: "#2D2A6E" }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#818CF8" }} />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t px-4 py-3" style={{ borderColor: "#4338CA", backgroundColor: "#1E1B4B" }}>
          {anexo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ backgroundColor: "#2D2A6E" }}>
              <Paperclip className="h-3 w-3 text-indigo-400" />
              <span className="text-indigo-300 flex-1 truncate">{anexo.name}</span>
              <button type="button" onClick={() => setAnexo(null)} className="text-red-400 cursor-pointer">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="cursor-pointer" style={{ color: "#818CF8" }}>
              <Paperclip className="h-5 w-5" />
            </button>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAnexo(e.target.files?.[0] || null)} />
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Digite um comando..."
              className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none text-white placeholder-indigo-400"
              style={{ backgroundColor: "#2D2A6E", borderColor: "#4338CA" }}
              disabled={loading}
            />
            <button type="submit" disabled={loading || (!input.trim() && !anexo)}
              className="flex items-center justify-center rounded-xl p-2 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: "#6366F1" }}>
              <Send className="h-4 w-4 text-white" />
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
