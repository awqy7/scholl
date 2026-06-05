import {
  deduplicarPeriodosPorRelogio,
  filtrarPeriodosPorTurno,
  filtrarTurmasPorTurno,
  turnosComTurmas,
  type TurmaComTurno,
} from "./grade-turno"

export interface AulaGradeInput {
  turma_id: string
  materia_id: string
  professor_id: string
  dia_semana: number
  periodo_id: string
}

export interface EntidadeGrade {
  id: string
  nome: string
}

export interface PeriodoGrade extends EntidadeGrade {
  tipo: string
  ordem: number
  hora_inicio?: string
  hora_fim?: string
}

export interface ProfessorGrade extends EntidadeGrade {
  especialidades?: string[]
}

export interface GerarGradeParams {
  turmas: EntidadeGrade[]
  materias: EntidadeGrade[]
  professores: ProfessorGrade[]
  periodos: PeriodoGrade[]
}

export interface TurmaComTurnoGrade extends EntidadeGrade {
  periodo?: string
}

export interface ValidacaoGrade {
  ok: boolean
  conflitos: string[]
  sequenciasLongas: string[]
}

const DIAS = [0, 1, 2, 3, 4]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
}

function professorCombinaMateria(prof: ProfessorGrade, materia: EntidadeGrade): number {
  const m = norm(materia.nome)
  const specs = (prof.especialidades || []).map(norm)
  if (specs.some((e) => e.includes(m) || m.includes(e))) return 3
  const palavras = m.split(/\s+/).filter((w) => w.length > 3)
  if (palavras.some((w) => specs.some((e) => e.includes(w)))) return 2
  return 1
}

function maxSequenciaConsecutiva(ordens: number[]): number {
  if (!ordens.length) return 0
  const sorted = [...new Set(ordens)].sort((a, b) => a - b)
  let max = 1
  let cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      cur++
      max = Math.max(max, cur)
    } else {
      cur = 1
    }
  }
  return max
}

export function chaveHorario(dia: number, periodoId: string) {
  return `${dia}|${periodoId}`
}

export function chaveSlotProfessor(profId: string, dia: number, periodoId: string) {
  return `${profId}|${dia}|${periodoId}`
}

export function chaveSlotTurma(turmaId: string, dia: number, periodoId: string) {
  return `${turmaId}|${dia}|${periodoId}`
}

function parseChaveSlotProfessor(key: string) {
  const parts = key.split("|")
  const periodoId = parts.pop()!
  const dia = Number(parts.pop())
  const profId = parts.join("|")
  return { profId, dia, periodoId }
}

function podeTerMaisAulaNoDia(
  profId: string,
  dia: number,
  ordem: number,
  ordensNoDia: Map<string, number[]>
): boolean {
  const chave = `${profId}|${dia}`
  const ordens = ordensNoDia.get(chave) || []
  return maxSequenciaConsecutiva([...ordens, ordem]) <= 2
}

function registrarOrdemNoDia(
  profId: string,
  dia: number,
  ordem: number,
  ordensNoDia: Map<string, number[]>
) {
  const chave = `${profId}|${dia}`
  const ordens = ordensNoDia.get(chave) || []
  ordens.push(ordem)
  ordensNoDia.set(chave, ordens)
}

/** Remove duplicatas: 1 professor → 1 turma por horário; 1 turma → 1 aula por horário. */
export function filtrarAulasSemConflitoHorario(aulas: AulaGradeInput[]): {
  aulas: AulaGradeInput[]
  ignoradas: number
} {
  const profUsado = new Set<string>()
  const turmaUsada = new Set<string>()
  const limpas: AulaGradeInput[] = []
  let ignoradas = 0

  const embaralhadas = shuffle(aulas)

  for (const a of embaralhadas) {
    const kp = chaveSlotProfessor(a.professor_id, a.dia_semana, a.periodo_id)
    const kt = chaveSlotTurma(a.turma_id, a.dia_semana, a.periodo_id)
    if (profUsado.has(kp) || turmaUsada.has(kt)) {
      ignoradas++
      continue
    }
    profUsado.add(kp)
    turmaUsada.add(kt)
    limpas.push(a)
  }

  return { aulas: limpas, ignoradas }
}

/**
 * Gera grade: em cada horário (dia + período) cada professor aparece NO MÁXIMO 1 vez.
 * Turmas e professores são sorteados aleatoriamente a cada horário.
 */
export function gerarGradeTodasSalas(params: GerarGradeParams): AulaGradeInput[] {
  const { turmas, materias, professores, periodos } = params
  if (!turmas.length || !materias.length || !professores.length || !periodos.length) {
    return []
  }

  const periodosAula = deduplicarPeriodosPorRelogio(
    periodos.filter((p) => p.tipo === "aula")
  )

  if (!periodosAula.length) return []

  const ordemPorId = new Map(periodosAula.map((p) => [p.id, p.ordem]))
  let melhor: AulaGradeInput[] = []
  const tentativas = Math.min(16, Math.max(6, professores.length * turmas.length))

  for (let t = 0; t < tentativas; t++) {
    const aulas: AulaGradeInput[] = []
    const ordensNoDia = new Map<string, number[]>()
    const materiaIdxPorTurma = new Map<string, number>()
    for (const turma of turmas) materiaIdxPorTurma.set(turma.id, Math.floor(Math.random() * materias.length))

    for (const dia of DIAS) {
      for (const periodo of periodosAula) {
        const ordem = ordemPorId.get(periodo.id) ?? periodo.ordem
        /** Professores já usados NESTE horário — um professor = uma sala por vez */
        const professoresNoHorario = new Set<string>()
        const turmasOrdenadas = shuffle(turmas)

        for (const turma of turmasOrdenadas) {
          let idx = materiaIdxPorTurma.get(turma.id) ?? 0
          let alocado = false

          for (let mOff = 0; mOff < materias.length && !alocado; mOff++) {
            const materia = materias[(idx + mOff) % materias.length]
            const candidatos = shuffle(professores).sort(
              (a, b) =>
                professorCombinaMateria(b, materia) - professorCombinaMateria(a, materia)
            )

            for (const prof of candidatos) {
              if (!prof.id) continue
              if (professoresNoHorario.has(prof.id)) continue
              if (!podeTerMaisAulaNoDia(prof.id, dia, ordem, ordensNoDia)) continue

              aulas.push({
                turma_id: turma.id,
                materia_id: materia.id,
                professor_id: prof.id,
                dia_semana: dia,
                periodo_id: periodo.id,
              })
              professoresNoHorario.add(prof.id)
              registrarOrdemNoDia(prof.id, dia, ordem, ordensNoDia)
              materiaIdxPorTurma.set(turma.id, idx + mOff + 1)
              alocado = true
              break
            }
          }
        }
      }
    }

    const { aulas: limpas } = filtrarAulasSemConflitoHorario(aulas)
    const validacao = validarGrade(limpas, periodosAula, turmas, professores)

    if (validacao.ok && limpas.length >= melhor.length) {
      melhor = limpas
    }
    if (validacao.ok && limpas.length === turmas.length * DIAS.length * periodosAula.length) {
      return limpas
    }
  }

  return filtrarAulasSemConflitoHorario(melhor).aulas
}

export function validarGrade(
  aulas: AulaGradeInput[],
  periodos: PeriodoGrade[],
  turmas: EntidadeGrade[],
  professores: ProfessorGrade[]
): ValidacaoGrade {
  const conflitos: string[] = []
  const sequenciasLongas: string[] = []
  const ordemPorId = new Map(periodos.map((p) => [p.id, p.ordem]))
  const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]))
  const nomeProf = new Map(professores.map((p) => [p.id, p.nome]))
  const dias = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]

  const porSlotProf = new Map<string, string[]>()
  for (const a of aulas) {
    const key = chaveSlotProfessor(a.professor_id, a.dia_semana, a.periodo_id)
    const lista = porSlotProf.get(key) || []
    lista.push(a.turma_id)
    porSlotProf.set(key, lista)
  }

  for (const [key, turmasIds] of porSlotProf) {
    if (turmasIds.length > 1) {
      const { profId, dia } = parseChaveSlotProfessor(key)
      const salas = turmasIds.map((id) => nomeTurma.get(id) || id).join(", ")
      conflitos.push(
        `${nomeProf.get(profId) || profId} — ${dias[dia] || dia}: em ${turmasIds.length} salas no mesmo horário (${salas})`
      )
    }
  }

  const ordensPorProfDia = new Map<string, number[]>()
  for (const a of aulas) {
    const ordem = ordemPorId.get(a.periodo_id)
    if (ordem == null) continue
    const k = `${a.professor_id}|${a.dia_semana}`
    const arr = ordensPorProfDia.get(k) || []
    arr.push(ordem)
    ordensPorProfDia.set(k, arr)
  }

  for (const [key, ordens] of ordensPorProfDia) {
    const max = maxSequenciaConsecutiva(ordens)
    if (max > 2) {
      const [profId, diaStr] = key.split("|")
      const dia = Number(diaStr)
      sequenciasLongas.push(
        `${nomeProf.get(profId) || profId} — ${dias[dia] || dia}: ${max} aulas seguidas (máximo 2)`
      )
    }
  }

  return {
    ok: conflitos.length === 0 && sequenciasLongas.length === 0,
    conflitos,
    sequenciasLongas,
  }
}

export function resumoGradeGerada(
  aulas: AulaGradeInput[],
  turmas: EntidadeGrade[],
  periodos: PeriodoGrade[]
): string {
  const periodosAula = deduplicarPeriodosPorRelogio(periodos.filter((p) => p.tipo === "aula"))
  const slotsPorTurma = turmas.length * DIAS.length * periodosAula.length
  const turmasComAula = new Set(aulas.map((a) => a.turma_id)).size
  return `${aulas.length} aula(s) em ${turmasComAula}/${turmas.length} salas (capacidade ${slotsPorTurma} slots).`
}

export interface ResultadoGradeTurnos {
  aulas: AulaGradeInput[]
  turnosProcessados: string[]
  avisos: string[]
}

export function gerarGradeTodosTurnos(
  params: Omit<GerarGradeParams, "turmas"> & { turmas: TurmaComTurnoGrade[] }
): AulaGradeInput[] {
  return gerarGradeTodosTurnosDetalhe(params).aulas
}

export function gerarGradeTodosTurnosDetalhe(
  params: Omit<GerarGradeParams, "turmas"> & { turmas: TurmaComTurnoGrade[] }
): ResultadoGradeTurnos {
  const { turmas, materias, professores, periodos } = params
  const turmasFull: TurmaComTurno[] = turmas.map((t) => ({
    id: t.id,
    nome: t.nome,
    periodo: t.periodo,
  }))

  const todas: AulaGradeInput[] = []
  const turnosProcessados: string[] = []
  const avisos: string[] = []

  for (const turno of turnosComTurmas(turmasFull)) {
    const turmasTurno = filtrarTurmasPorTurno(turmasFull, turno)
    const periodosTurno = deduplicarPeriodosPorRelogio(filtrarPeriodosPorTurno(periodos, turno))
    const periodosAula = periodosTurno.filter((p) => p.tipo === "aula")

    if (!turmasTurno.length) continue

    if (!periodosAula.length) {
      avisos.push(
        turno === "tarde"
          ? "Vespertino: faltam períodos com horário a partir de 12h (foram criados automaticamente na próxima geração)."
          : `Turno ${turno}: sem períodos de aula compatíveis.`
      )
      continue
    }

    const parcial = gerarGradeTodasSalas({
      turmas: turmasTurno,
      materias,
      professores,
      periodos: periodosTurno,
    })
    todas.push(...parcial)
    turnosProcessados.push(turno)
  }

  return {
    aulas: filtrarAulasSemConflitoHorario(todas).aulas,
    turnosProcessados,
    avisos,
  }
}