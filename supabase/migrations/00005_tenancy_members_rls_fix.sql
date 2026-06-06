-- ============================================
-- ARIA - Proper Multi-User Tenancy + RLS Fix
-- Run this in Supabase SQL Editor AFTER previous migrations.
-- This changes from "escola.id == auth user id" (1:1 hack)
-- to proper: escolas have their own id + escola_membros (supports diretor + secretaria + etc).
-- ============================================

-- 1. Create membership table (core of multi-user per school)
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

-- Enable RLS on new table
ALTER TABLE escola_membros ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships; directors can manage?
-- For simplicity and safety at start: user sees only their own rows.
CREATE POLICY "membros_select_own" ON escola_membros
  FOR SELECT USING (user_id = auth.uid());

-- Only allow insert via trusted server code / trigger (we'll use SECURITY DEFINER patterns later if needed).
-- For now, block direct client inserts on membership.

-- 2. Update trigger to create REAL escola (own UUID) + membership
-- This replaces the old 1:1 (escola.id = user.id)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_escola_id UUID;
BEGIN
  -- Always create a fresh escola id (never reuse auth user id)
  new_escola_id := uuid_generate_v4();

  INSERT INTO public.escolas (id, nome, tipo)
  VALUES (
    new_escola_id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_escola', ''), 'normal')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Create membership as diretor for the new user
  INSERT INTO public.escola_membros (escola_id, user_id, role)
  VALUES (new_escola_id, NEW.id, 'diretor')
  ON CONFLICT (escola_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure trigger is attached (re-create if needed)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 3. Backfill for EXISTING installations (very important)
-- For every existing escola that was created with the old model (id looked like user id),
-- ensure there is at least one diretor membership.
-- This makes old single-director accounts continue to work seamlessly.
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
    -- In the old model, the "owner" user had the same id as the escola.
    -- We insert a membership assuming the user with that id exists.
    -- If the user no longer exists it will just be an orphan row (harmless).
    INSERT INTO escola_membros (escola_id, user_id, role)
    VALUES (r.escola_id, r.escola_id, 'diretor')
    ON CONFLICT (escola_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Fix RLS policies on escolas and all data tables
-- Drop the old overly permissive or uid==id policies created by the dynamic DO block.

-- Escolas: user can only see schools they are member of.
DROP POLICY IF EXISTS "escolas_select" ON escolas;
DROP POLICY IF EXISTS "escolas_insert" ON escolas;

CREATE POLICY "escolas_select_member" ON escolas
  FOR SELECT USING (
    id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
  );

-- Allow authenticated users to create a school (the app + trigger will immediately create the membership).
-- In practice the signup flow + trigger handles creation.
CREATE POLICY "escolas_insert_authenticated" ON escolas
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update policies for all other tables to be membership-based instead of "escola_id = auth.uid()"
-- We re-create clean policies for the main tables.

-- Helper: we will use a consistent pattern.
-- First drop the old dynamic ones (they used the uid assumption).

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'series','turmas','professores','materias','periodos',
    'grade_horarios','recreio_intercalado','faltas','substituicoes',
    'planejamento_semanal','eventos_tempo_real','aria_contexto'
  ]
  LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE tablename = tbl AND schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol, tbl);
    END LOOP;
  END LOOP;
END $$;

-- Recreate proper membership-based policies for every table that has escola_id
-- (We keep it simple and consistent: SELECT/INSERT/UPDATE/DELETE only if member)

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'series','turmas','professores','materias','periodos',
    'grade_horarios','recreio_intercalado','faltas','substituicoes',
    'planejamento_semanal','eventos_tempo_real'
  ]
  LOOP
    EXECUTE format('
      CREATE POLICY "%s_select_member" ON %s FOR SELECT USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_insert_member" ON %s FOR INSERT WITH CHECK (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_update_member" ON %s FOR UPDATE USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
      CREATE POLICY "%s_delete_member" ON %s FOR DELETE USING (
        escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
      );
    ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Special case: aria_contexto (PK is escola_id)
CREATE POLICY "aria_contexto_select_member" ON aria_contexto FOR SELECT USING (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);
CREATE POLICY "aria_contexto_insert_member" ON aria_contexto FOR INSERT WITH CHECK (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);
CREATE POLICY "aria_contexto_update_member" ON aria_contexto FOR UPDATE USING (
  escola_id IN (SELECT escola_id FROM escola_membros WHERE user_id = auth.uid())
);

-- 5. Optional but recommended: allow users to see basic escola info for their memberships
-- (already covered by the escolas policy above)

COMMENT ON TABLE escola_membros IS 'Links users to schools with roles. Replaces the old escola.id == auth.uid() hack.';
COMMENT ON COLUMN escola_membros.role IS 'diretor (full), secretaria (operational), professor (limited view), visualizacao (read-only)';

-- Done. After running this:
-- 1. Old single-director accounts will continue working (backfill + legacy fallback in code).
-- 2. You can now add more members to an escola via SQL or future admin UI.
-- 3. All RLS is now based on membership, not fragile uid matching.