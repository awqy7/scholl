-- Memória persistente da ARIA por escola (diretor / contexto)
CREATE TABLE IF NOT EXISTS aria_contexto (
  escola_id UUID PRIMARY KEY REFERENCES escolas(id) ON DELETE CASCADE,
  resumo TEXT DEFAULT '',
  memoria JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE aria_contexto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aria_contexto_select" ON aria_contexto
  FOR SELECT USING (escola_id = auth.uid());

CREATE POLICY "aria_contexto_insert" ON aria_contexto
  FOR INSERT WITH CHECK (escola_id = auth.uid());

CREATE POLICY "aria_contexto_update" ON aria_contexto
  FOR UPDATE USING (escola_id = auth.uid());