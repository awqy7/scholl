-- Um professor só pode estar em uma turma por horário (dia + período)
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_professor_horario_unico
  ON grade_horarios (escola_id, professor_id, dia_semana, periodo_id);

-- Cada turma/sala só pode ter uma aula por horário
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_turma_horario_unico
  ON grade_horarios (turma_id, dia_semana, periodo_id);