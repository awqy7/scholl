-- ============================================================
-- ESCOLA INTELIGENTE - SCHEMA COMPLETO (TODAS AS MIGRATIONS)
-- Versão única e consolidada - Execute no Supabase SQL Editor
-- ============================================================
-- Este arquivo substitui todas as migrations 00001 a 00007.
-- Rode uma única vez em um projeto novo ou para recriar o schema.
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELAS BASE
-- ============================================================

-- ESCOLAS
CREATE TABLE IF NOT EXISTS escolas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'normal' CHECK (tipo IN ('creche', 'normal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN escolas.tipo IS 'creche = berçário/maternal com recreio escalonado; normal = ensino regular';

-- SÉRIES
CREATE TABLE IF NOT EXISTS series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TURMAS (com colunas de responsáveis padrão da sala - da 00007)
CREATE TABLE IF NOT EXISTS turmas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  serie_id UUID REFERENCES series(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  periodo TEXT NOT NULL CHECK (periodo IN ('manha', 'tarde', 'integral')),
  professor_responsavel_id UUID REFERENCES professores(id) ON DELETE SET NULL,
  monitor_responsavel_id UUID REFERENCES monitores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN turmas.professor_responsavel_id IS 'Professor principal/responsável padrão desta sala (usado para auto-preencher recreio e rotinas)';
COMMENT ON COLUMN turmas.monitor_responsavel_id IS 'Monitor/auxiliar responsável padrão desta sala (usado principalmente para recreio escalonado)';

-- PROFESSORES
CREATE TABLE IF NOT EXISTS professores (
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

-- MATÉRIAS
CREATE TABLE IF NOT EXISTS materias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PERÍODOS
CREATE TABLE IF NOT EXISTS periodos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'aula', 'recreio', 'saida')),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GRADE HORÁRIA
CREATE TABLE IF NOT EXISTS grade_horarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  materia_id UUID NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 4),
  periodo_id UUID NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FALTAS
CREATE TABLE IF NOT EXISTS faltas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  professor_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'justificada' CHECK (status IN ('justificada', 'injustificada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBSTITUIÇÕES
CREATE TABLE IF NOT EXISTS substituicoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  falta_id UUID REFERENCES faltas(id) ON DELETE SET NULL,
  professor_original_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  professor_substituto_id UUID NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmada', 'recusada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PLANEJAMENTO SEMANAL
CREATE TABLE IF NOT EXISTS planejamento_semanal (
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

-- EVENTOS TEMPO REAL
CREATE TABLE IF NOT EXISTS eventos_tempo_real (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicio_aula', 'fim_aula', 'inicio_recreio', 'fim_recreio', 'falta', 'substituicao', 'alerta')),
  mensagem TEXT NOT NULL,
  turma_id UUID REFERENCES turmas(id) ON DELETE SET NULL,
  professor_id UUID REFERENCES professores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELAS NOVAS / CRECHE / TENANCY
-- ============================================================

-- MEMBROS DA ESCOLA (multi-usuário por escola - da 00005)
CREATE TABLE IF NOT EXISTS escola_membros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'diretor' CHECK (role IN ('diretor', 'secretaria', 'professor', 'visualizacao')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (escola_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_membros_user ON escola_membros(user_id);
CREATE INDEX IF NOT EXISTS idx_membros_escola ON escola_membros(escola_id);

-- ARIA CONTEXTO (memória da IA por escola)
CREATE TABLE IF NOT EXISTS aria_contexto (
  escola_id UUID PRIMARY KEY REFERENCES escolas(id) ON DELETE CASCADE,
  resumo TEXT DEFAULT '',
  memoria JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MONITORES (para creche - da 00006)
CREATE TABLE IF NOT EXISTS monitores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RECREIO SUPERVISIONADO (creche escalonado - da 00006)
CREATE TABLE IF NOT EXISTS recreio_supervisao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  escola_id UUID NOT NULL REFERENCES escolas(id) ON DELETE CASCADE,
  periodo_id UUID NOT NULL REFERENCES periodos(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  turma_id UUID NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  professor_id UUID REFERENCES professores(id) ON DELETE SET NULL,
  monitor_id UUID REFERENCES monitores(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (escola_id, periodo_id, dia_semana, turma_id)
);

-- ATIVIDADES DURANTE O RECREIO
CREATE TABLE IF NOT EXISTS recreio_atividades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recreio_supervisao_id UUID NOT NULL REFERENCES recreio_supervisao(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  duracao_minutos INTEGER,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_turmas_escola ON turmas(escola_id);
CREATE INDEX IF NOT EXISTS idx_professores_escola ON professores(escola_id);
CREATE INDEX IF NOT EXISTS idx_grade_turma ON grade_horarios(turma_id);
CREATE INDEX IF NOT EXISTS idx_grade_professor ON grade_horarios(professor_id);
CREATE INDEX IF NOT EXISTS idx_grade_dia ON grade_horarios(dia_semana);
CREATE INDEX IF NOT EXISTS idx_faltas_data ON faltas(data);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos_tempo_real(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recreio_dia ON recreio_intercalado(dia_semana);
CREATE INDEX IF NOT EXISTS idx_substituicoes_status ON substituicoes(status);

-- Índices extras da 00006 e 00007
CREATE INDEX IF NOT EXISTS idx_recreio_supervisao_escola ON recreio_supervisao(escola_id);
CREATE INDEX IF NOT EXISTS idx_recreio_supervisao_periodo_dia ON recreio_supervisao(periodo_id, dia_semana);
CREATE INDEX IF NOT EXISTS idx_recreio_atividades_supervisao ON recreio_atividades(recreio_supervisao_id);
CREATE INDEX IF NOT EXISTS idx_turmas_professor_responsavel ON turmas(professor_responsavel_id);
CREATE INDEX IF NOT EXISTS idx_turmas_monitor_responsavel ON turmas(monitor_responsavel_id);

-- Unicidade da grade (da 00004)
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_professor_horario_unico
  ON grade_horarios (escola_id, professor_id, dia_semana, periodo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_turma_horario_unico
  ON grade_horarios (turma_id, dia_semana, periodo_id);

-- ============================================================
-- RLS (Row Level Security) - Versão moderna com escola_membros (00005 + 00006)
-- ============================================================

ALTER TABLE escolas ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE materias ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE faltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE substituicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE planejamento_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_tempo_real ENABLE ROW LEVEL SECURITY;
ALTER TABLE escola_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE aria_contexto ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitores ENABLE ROW LEVEL SECURITY;
ALTER TABLE recreio_supervisao ENABLE ROW LEVEL SECURITY;
ALTER TABLE recreio_atividades ENABLE ROW LEVEL SECURITY;

-- Políticas para escolas (idempotente)
DROP POLICY IF EXISTS "escolas_select" ON escolas;
DROP POLICY IF EXISTS "escolas_insert" ON escolas;
DROP POLICY IF EXISTS "escolas_select_member" ON escolas;
DROP POLICY IF EXISTS "escolas_insert_authenticated" ON escolas;

CREATE POLICY "escolas_select_member" ON escolas
  FOR SELECT USING (
    id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
  );

CREATE POLICY "escolas_insert_authenticated" ON escolas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Políticas baseadas em membership para todas as tabelas com escola_id
-- (Versão robusta/idempotente: remove TODAS as policies da tabela antes de recriar)
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'series','turmas','professores','materias','periodos',
    'grade_horarios','faltas','substituicoes',
    'planejamento_semanal','eventos_tempo_real',
    'monitores','recreio_supervisao'
  ]
  LOOP
    -- Drop ALL existing policies for this table (makes it safe to re-run)
    FOR pol IN 
      SELECT policyname 
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, tbl);
    END LOOP;

    -- Recreate clean membership-based policies
    EXECUTE format('
      CREATE POLICY "%s_select_member" ON %I FOR SELECT USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_insert_member" ON %I FOR INSERT WITH CHECK (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_update_member" ON %I FOR UPDATE USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_delete_member" ON %I FOR DELETE USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Políticas especiais para escola_membros e aria_contexto (idempotente)
DROP POLICY IF EXISTS "membros_select_own" ON escola_membros;
DROP POLICY IF EXISTS "membros_insert" ON escola_membros;
DROP POLICY IF EXISTS "membros_update" ON escola_membros;
DROP POLICY IF EXISTS "membros_delete" ON escola_membros;

CREATE POLICY "membros_select_own" ON escola_membros
  FOR SELECT USING (user_id = auth.uid());

-- (insert/update/delete on membros geralmente são bloqueados ou via funções SECURITY DEFINER)

DROP POLICY IF EXISTS "aria_contexto_select_member" ON aria_contexto;
DROP POLICY IF EXISTS "aria_contexto_insert_member" ON aria_contexto;
DROP POLICY IF EXISTS "aria_contexto_update_member" ON aria_contexto;
DROP POLICY IF EXISTS "aria_contexto_delete_member" ON aria_contexto;

CREATE POLICY "aria_contexto_select_member" ON aria_contexto FOR SELECT USING (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);
CREATE POLICY "aria_contexto_insert_member" ON aria_contexto FOR INSERT WITH CHECK (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);
CREATE POLICY "aria_contexto_update_member" ON aria_contexto FOR UPDATE USING (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);
CREATE POLICY "aria_contexto_delete_member" ON aria_contexto FOR DELETE USING (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);

-- Políticas para recreio_atividades (via supervisao)
DROP POLICY IF EXISTS "recreio_atividades_visivel_via_supervisao" ON recreio_atividades;

CREATE POLICY "recreio_atividades_visivel_via_supervisao" ON recreio_atividades
  FOR ALL USING (
    recreio_supervisao_id IN (
      SELECT id FROM recreio_supervisao 
      WHERE escola_id IN (
        SELECT escola_id FROM escola_membros WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- FUNÇÕES E TRIGGERS
-- ============================================================

-- Trigger principal para novo usuário (multi-tenant + tipo de escola)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_escola_id UUID;
BEGIN
  new_escola_id := uuid_generate_v4();

  INSERT INTO public.escolas (id, nome, tipo)
  VALUES (
    new_escola_id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_escola', ''), 'normal')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.escola_membros (escola_id, user_id, role)
  VALUES (new_escola_id, NEW.id, 'diretor')
  ON CONFLICT (escola_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Backfill para instalações antigas (00005)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT e.id AS escola_id
    FROM escolas e
    WHERE NOT EXISTS (
      SELECT 1 FROM escola_membros m WHERE m.escola_id = e.id
    )
  LOOP
    INSERT INTO escola_membros (escola_id, user_id, role)
    VALUES (r.escola_id, r.escola_id, 'diretor')
    ON CONFLICT (escola_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- ============================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ============================================================

COMMENT ON TABLE escola_membros IS 'Links users to schools with roles. Supports multi-user per school (diretor + secretaria).';
COMMENT ON TABLE monitores IS 'Monitores / auxiliares de creche responsáveis pela supervisão de recreio';
COMMENT ON TABLE recreio_supervisao IS 'Atribui professor + monitor para supervisionar o recreio de uma turma em um horário específico. Permite múltiplas turmas no mesmo horário com equipes diferentes.';
COMMENT ON TABLE recreio_atividades IS 'Atividades, brincadeiras ou rotinas que acontecem durante o recreio de uma determinada supervisão/turma.';

-- Fim do schema completo
