-- Tipo de escola: creche (educação infantil) ou normal (ensino regular)
ALTER TABLE escolas
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'normal'
  CHECK (tipo IN ('creche', 'normal'));

COMMENT ON COLUMN escolas.tipo IS 'creche = berçário/maternal com recreio intercalado; normal = ensino regular';

-- Atualiza trigger de novo usuário para gravar tipo_escola do cadastro
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.escolas (id, nome, tipo)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_escola', ''), 'normal')
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, escolas.nome),
    tipo = COALESCE(
      NULLIF(EXCLUDED.tipo, 'normal'),
      escolas.tipo
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;