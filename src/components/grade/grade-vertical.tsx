"use client"

import { useMemo } from "react"
import { DIAS_SEMANA } from "@/lib/utils"
import { chaveSlotProfessor } from "@/lib/grade-gerador"
import type { GradeHorario, Turma, Periodo } from "@/types/database"

const DIAS_INDICES = [0, 1, 2, 3, 4] as const

function prepararGradeExibicao(grade: GradeHorario[]): GradeHorario[] {
  const vistos = new Set<string>()
  const limpa: GradeHorario[] = []
  const ordenada = [...grade].sort((a, b) => a.turma_id.localeCompare(b.turma_id))
  for (const g of ordenada) {
    const kp = chaveSlotProfessor(g.professor_id, g.dia_semana, g.periodo_id)
    if (vistos.has(kp)) continue
    vistos.add(kp)
    limpa.push(g)
  }
  return limpa
}

function CelulaAula({ celula }: { celula: GradeHorario }) {
  const cor = celula.materia?.cor || "#6366f1"
  return (
    <div
      className="grade-celula-aula"
      style={{
        backgroundColor: `${cor}18`,
        borderLeft: `3px solid ${cor}`,
        boxShadow: `0 0 0 1px ${cor}22`,
      }}
    >
      <div className="font-semibold text-[0.8rem] leading-tight truncate" title={celula.materia?.nome}>
        {celula.materia?.nome}
      </div>
      <div
        className="mt-1 truncate text-[0.7rem]"
        style={{ color: "var(--aria-text-muted)" }}
        title={celula.professor?.nome}
      >
        {celula.professor?.nome}
      </div>
    </div>
  )
}

function TabelaDia({
  dia,
  nomeDia,
  turmas,
  periodosAula,
  getCelula,
}: {
  dia: number
  nomeDia: string
  turmas: Turma[]
  periodosAula: Periodo[]
  getCelula: (turmaId: string, periodoId: string) => GradeHorario | undefined
}) {
  const aulasNoDia = periodosAula.reduce((n, per) => {
    return n + turmas.filter((t) => getCelula(t.id, per.id)).length
  }, 0)

  return (
    <section
      className="grade-dia-bloco"
      style={{ animationDelay: `${dia * 60}ms` }}
      aria-labelledby={`grade-dia-${dia}`}
    >
      <header className="grade-dia-cabecalho">
        <div>
          <p className="grade-dia-indice">Dia {dia + 1}</p>
          <h2 id={`grade-dia-${dia}`} className="grade-dia-titulo">
            {nomeDia}
          </h2>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: "var(--aria-accent-soft)",
            color: "var(--aria-accent)",
            border: "1px solid rgba(34, 211, 238, 0.2)",
          }}
        >
          {aulasNoDia} aula{aulasNoDia !== 1 ? "s" : ""}
        </span>
      </header>

      <div className="grade-dia-corpo">
        <table className="grade-dia-tabela">
          <thead>
            <tr>
              <th
                className="p-3 text-left text-xs font-semibold uppercase tracking-wider w-[7.5rem]"
                style={{ color: "var(--aria-text-subtle)" }}
              >
                Horário
              </th>
              {turmas.map((t) => (
                <th
                  key={t.id}
                  className="p-3 text-center text-xs font-medium min-w-[7.5rem]"
                  style={{ color: "var(--aria-text-muted)" }}
                >
                  <span className="block font-semibold" style={{ color: "var(--aria-text)" }}>
                    {t.nome}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodosAula.map((per, rowIdx) => (
              <tr
                key={per.id}
                className={rowIdx > 0 ? "border-t" : ""}
                style={{ borderColor: "var(--aria-border)" }}
              >
                <td className="p-2 align-top whitespace-nowrap">
                  <div className="font-medium text-sm" style={{ color: "var(--aria-text)" }}>
                    {per.nome}
                  </div>
                  <div className="text-[0.65rem] mt-0.5" style={{ color: "var(--aria-text-subtle)" }}>
                    {per.hora_inicio} – {per.hora_fim}
                  </div>
                </td>
                {turmas.map((t) => {
                  const celula = getCelula(t.id, per.id)
                  return (
                    <td key={`${t.id}-${per.id}`} className="p-1.5 align-top">
                      {celula ? <CelulaAula celula={celula} /> : <div className="grade-celula-vazia" />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function GradeVertical({
  turmas,
  periodosAula,
  grade,
  rotuloSalas,
}: {
  turmas: Turma[]
  periodosAula: Periodo[]
  grade: GradeHorario[]
  rotuloSalas: string
}) {
  const gradeExibicao = useMemo(() => prepararGradeExibicao(grade), [grade])

  function getCelula(turmaId: string, dia: number, periodoId: string) {
    return gradeExibicao.find(
      (g) => g.turma_id === turmaId && g.dia_semana === dia && g.periodo_id === periodoId
    )
  }

  if (!turmas.length) {
    return (
      <p className="p-10 text-center text-sm" style={{ color: "var(--aria-text-muted)" }}>
        Nenhuma {rotuloSalas.toLowerCase()} neste turno. Cadastre turmas com período Manhã ou Tarde.
      </p>
    )
  }

  if (!periodosAula.length) {
    return (
      <div className="p-10 text-center text-sm space-y-2" style={{ color: "var(--aria-text-muted)" }}>
        <p>Não há horários de aula para este turno no banco.</p>
        <p className="text-xs" style={{ color: "var(--aria-text-subtle)" }}>
          Clique em <strong>Gerar grade (todos os turnos)</strong> — a ARIA cria os horários vespertinos
          automaticamente e monta matutino + vespertino.
        </p>
      </div>
    )
  }

  const temAlgumaAula = DIAS_INDICES.some((dia) =>
    periodosAula.some((per) => turmas.some((t) => getCelula(t.id, dia, per.id)))
  )

  if (!temAlgumaAula) {
    return (
      <div className="p-10 text-center text-sm space-y-2" style={{ color: "var(--aria-text-muted)" }}>
        <p>Nenhuma aula neste turno ainda.</p>
        <p className="text-xs" style={{ color: "var(--aria-text-subtle)" }}>
          Use <strong>Gerar grade (todos os turnos)</strong> para preencher matutino e vespertino de uma vez.
        </p>
      </div>
    )
  }

  return (
    <div className="grade-dias-stack">
      {DIAS_INDICES.map((dia) => (
        <TabelaDia
          key={dia}
          dia={dia}
          nomeDia={DIAS_SEMANA[dia]}
          turmas={turmas}
          periodosAula={periodosAula}
          getCelula={(turmaId, periodoId) => getCelula(turmaId, dia, periodoId)}
        />
      ))}
    </div>
  )
}