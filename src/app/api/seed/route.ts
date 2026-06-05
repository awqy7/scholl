import { createServerSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const escolaId = user.id

  // Verificar se já tem dados
  const { count } = await supabase.from("turmas").select("*", { count: "exact", head: true }).eq("escola_id", escolaId)
  if (count && count > 0) {
    return NextResponse.json({ error: "Já existem dados cadastrados" }, { status: 400 })
  }

  // 1. SÉRIES
  const seriesData = [
    { escola_id: escolaId, nome: "Maternal", ordem: 1 },
    { escola_id: escolaId, nome: "Jardim 1", ordem: 2 },
    { escola_id: escolaId, nome: "Jardim 2", ordem: 3 },
    { escola_id: escolaId, nome: "Jardim 3", ordem: 4 },
    { escola_id: escolaId, nome: "Pré-escola", ordem: 5 },
  ]
  const { data: series } = await supabase.from("series").insert(seriesData).select()
  if (!series) return NextResponse.json({ error: "Erro ao criar séries" }, { status: 500 })

  // 2. TURMAS
  const turmasData = [
    { escola_id: escolaId, serie_id: series[0].id, nome: "Maternal A", periodo: "manha" },
    { escola_id: escolaId, serie_id: series[0].id, nome: "Maternal B", periodo: "tarde" },
    { escola_id: escolaId, serie_id: series[1].id, nome: "Jardim 1 A", periodo: "manha" },
    { escola_id: escolaId, serie_id: series[1].id, nome: "Jardim 1 B", periodo: "tarde" },
    { escola_id: escolaId, serie_id: series[2].id, nome: "Jardim 2 A", periodo: "manha" },
    { escola_id: escolaId, serie_id: series[2].id, nome: "Jardim 2 B", periodo: "tarde" },
    { escola_id: escolaId, serie_id: series[3].id, nome: "Jardim 3 A", periodo: "manha" },
    { escola_id: escolaId, serie_id: series[4].id, nome: "Pré-escola A", periodo: "integral" },
  ]
  const { data: turmas } = await supabase.from("turmas").insert(turmasData).select()
  if (!turmas) return NextResponse.json({ error: "Erro ao criar turmas" }, { status: 500 })

  // 3. PROFESSORES
  const profsData = [
    { escola_id: escolaId, nome: "Maria Silva", email: "maria@escola.com", especialidades: ["Matemática", "Educação Infantil"], status: "presente", carga_horaria: 30 },
    { escola_id: escolaId, nome: "João Santos", email: "joao@escola.com", especialidades: ["Português", "Literatura"], status: "presente", carga_horaria: 25 },
    { escola_id: escolaId, nome: "Ana Oliveira", email: "ana@escola.com", especialidades: ["Artes", "Música"], status: "presente", carga_horaria: 20 },
    { escola_id: escolaId, nome: "Carlos Lima", email: "carlos@escola.com", especialidades: ["Educação Física"], status: "presente", carga_horaria: 20 },
    { escola_id: escolaId, nome: "Julia Costa", email: "julia@escola.com", especialidades: ["Inglês"], status: "presente", carga_horaria: 25 },
    { escola_id: escolaId, nome: "Pedro Almeida", email: "pedro@escola.com", especialidades: ["Matemática", "Ciências"], status: "presente", carga_horaria: 30 },
    { escola_id: escolaId, nome: "Lucia Ferreira", email: "lucia@escola.com", especialidades: ["Educação Infantil", "Psicopedagogia"], status: "presente", carga_horaria: 30 },
    { escola_id: escolaId, nome: "Rafael Souza", email: "rafael@escola.com", especialidades: ["História", "Geografia"], status: "presente", carga_horaria: 20 },
  ]
  const { data: profs } = await supabase.from("professores").insert(profsData).select()
  if (!profs) return NextResponse.json({ error: "Erro ao criar professores" }, { status: 500 })

  // 4. MATÉRIAS
  const materiasData = [
    { escola_id: escolaId, nome: "Matemática", cor: "#EF4444" },
    { escola_id: escolaId, nome: "Português", cor: "#3B82F6" },
    { escola_id: escolaId, nome: "Ciências", cor: "#10B981" },
    { escola_id: escolaId, nome: "História", cor: "#F59E0B" },
    { escola_id: escolaId, nome: "Geografia", cor: "#8B5CF6" },
    { escola_id: escolaId, nome: "Artes", cor: "#EC4899" },
    { escola_id: escolaId, nome: "Educação Física", cor: "#14B8A6" },
    { escola_id: escolaId, nome: "Inglês", cor: "#F97316" },
    { escola_id: escolaId, nome: "Música", cor: "#6366F1" },
    { escola_id: escolaId, nome: "Educação Infantil", cor: "#84CC16" },
  ]
  const { data: materias } = await supabase.from("materias").insert(materiasData).select()
  if (!materias) return NextResponse.json({ error: "Erro ao criar matérias" }, { status: 500 })

  // 5. PERÍODOS
  const periodosManha = [
    { escola_id: escolaId, nome: "Entrada", tipo: "entrada", hora_inicio: "07:30", hora_fim: "08:00", ordem: 1 },
    { escola_id: escolaId, nome: "1º Período", tipo: "aula", hora_inicio: "08:00", hora_fim: "08:50", ordem: 2 },
    { escola_id: escolaId, nome: "2º Período", tipo: "aula", hora_inicio: "08:50", hora_fim: "09:40", ordem: 3 },
    { escola_id: escolaId, nome: "Recreio", tipo: "recreio", hora_inicio: "09:40", hora_fim: "10:00", ordem: 4 },
    { escola_id: escolaId, nome: "3º Período", tipo: "aula", hora_inicio: "10:00", hora_fim: "10:50", ordem: 5 },
    { escola_id: escolaId, nome: "4º Período", tipo: "aula", hora_inicio: "10:50", hora_fim: "11:40", ordem: 6 },
    { escola_id: escolaId, nome: "Saída", tipo: "saida", hora_inicio: "11:40", hora_fim: "12:00", ordem: 7 },
  ]
  const { data: periodos } = await supabase.from("periodos").insert(periodosManha).select()

  // 6. EVENTO INICIAL
  await supabase.from("eventos_tempo_real").insert({
    escola_id: escolaId,
    tipo: "alerta",
    mensagem: "Sistema inicializado com dados de exemplo! 🎉",
  })

  return NextResponse.json({
    message: "Dados de exemplo criados com sucesso!",
    stats: {
      series: series.length,
      turmas: turmas.length,
      professores: profs.length,
      materias: materias.length,
      periodos: periodos?.length || 0,
    },
  })
}
