-- ============================================
-- ESCOLA INTELIGENTE - Schema Completo
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ESCOLAS (vinculada ao auth.users)
CREATE TABLE escolas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SÉRIES (Maternal, Jardim 1, 2, 3, etc)
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TURMAS
CREATE TABLE turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  serie_id UUID REFERENCES series(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  periodo TEXT NOT NULL CHECK (periodo IN ('manha', 'tarde', 'integral')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROFESSORES
CREATE TABLE professores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT DEFAULT '',
  especialidades TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'presente' CHECK (status IN ('presente', 'ausente', 'ferias', 'licenca', 'atestado')),
  carga_horaria INTEGER NOT NULL DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MATÉRIAS
CREATE TABLE materias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PERÍODOS (entrada, aula, recreio, saída)
CREATE TABLE periodos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'aula', 'recreio', 'saida')),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. GRADE HORÁRIA
CREATE TABLE grade_horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  materia_id UUID NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 4),
  periodo_id UUID NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RECREIO INTERCALADO
CREATE TABLE recreio_intercalado (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 4),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. FALTAS
CREATE TABLE faltas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'justificada' CHECK (status IN ('justificada', 'injustificada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SUBSTITUIÇÕES
CREATE TABLE substituicoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  falta_id UUID REFERENCES faltas(id) ON DELETE SET NULL,
  professor_original_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  professor_substituto_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'recusada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PLANEJAMENTO SEMANAL
CREATE TABLE planejamento_semanal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  materia_id UUID NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  semana_inicio DATE NOT NULL,
  conteudo TEXT NOT NULL,
  objetivos TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. EVENTOS TEMPO REAL
CREATE TABLE eventos_tempo_real (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicio_aula', 'fim_aula', 'inicio_recreio', 'fim_recreio', 'falta', 'substituicao', 'alerta')),
  mensagem TEXT NOT NULL,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  professor_id UUID REFERENCES professores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX idx_turmas_escola ON turmas(escola_id);
CREATE INDEX idx_professores_escola ON professores(escola_id);
CREATE INDEX idx_grade_turma ON grade_horarios(turma_id);
CREATE INDEX idx_grade_professor ON grade_horarios(professor_id);
CREATE INDEX idx_grade_dia ON grade_horarios(dia_semana);
CREATE INDEX idx_faltas_data ON faltas(data);
CREATE INDEX idx_eventos_data ON eventos_tempo_real(created_at DESC);
CREATE INDEX idx_recreio_dia ON recreio_intercalado(dia_semana);
CREATE INDEX idx_substituicoes_status ON substituicoes(status);

-- RLS (Row Level Security)
ALTER TABLE escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recreio_intercalado ENABLE ROW LEVEL SECURITY;
ALTER TABLE faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE planejamento_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_tempo_real ENABLE ROW LEVEL SECURITY;

-- Políticas: cada escola vê apenas seus dados
CREATE POLICY "escolas_insert" ON escolas FOR INSERT WITH CHECK (true);
CREATE POLICY "escolas_select" ON escolas FOR SELECT USING (true);

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['series', 'turmas', 'professores', 'materias', 'periodos', 'grade_horarios', 'recreio_intercalado', 'faltas', 'substituicoes', 'planejamento_semanal', 'eventos_tempo_real']
  LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON %s FOR SELECT USING (escola_id = auth.uid());
      CREATE POLICY "%s_insert" ON %s FOR INSERT WITH CHECK (escola_id = auth.uid());
      CREATE POLICY "%s_update" ON %s FOR UPDATE USING (escola_id = auth.uid());
      CREATE POLICY "%s_delete" ON %s FOR DELETE USING (escola_id = auth.uid());
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Trigger: criar escola automaticamente ao cadastrar usuário
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.escolas (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
