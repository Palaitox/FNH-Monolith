-- ============================================================
-- FNH MONOLITH — Migration 0012: Production Fixes
--
-- Fixes needed on the production DB (qolnrtoznrgiedyhffbn):
--   1. Add 'termino_indefinido' to the jornada_laboral CHECK constraint
--   2. Create atomic case-number counter (config + RPCs)
--   3. Create system_logs table for permanent forensic records
--   4. Create contracts storage bucket + RLS policies
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ============================================================
-- FIX 1 — Add 'termino_indefinido' to the jornada_laboral CHECK
-- The old constraint (employees_jornada_check) only has 3 values.
-- Drop it and add a new one with all 4.
-- ============================================================

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_jornada_check;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_jornada_laboral_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_jornada_laboral_check
  CHECK (jornada_laboral IN (
    'tiempo_completo',
    'medio_tiempo',
    'prestacion_servicios',
    'termino_indefinido'
  ));


-- ============================================================
-- FIX 2 — Atomic case-number counter
--
-- Stores { year: YYYY, next: NNN } in config.
-- peek_next_case_number() — read-only, for UI preview
-- claim_next_case_number() — atomically increments, returns assigned number
-- ============================================================

-- Ensure config table exists (it's used for app_settings too)
CREATE TABLE IF NOT EXISTS public.config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- Seed the counter (no-op if already present)
INSERT INTO public.config (key, value)
VALUES ('case_counter', jsonb_build_object('year', extract(year from now())::int, 'next', 1))
ON CONFLICT (key) DO NOTHING;

-- Read-only peek: returns what the next number WOULD be, without consuming it
CREATE OR REPLACE FUNCTION public.peek_next_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
  v_cur_year int := extract(year from now())::int;
  v_counter jsonb;
BEGIN
  SELECT value INTO v_counter FROM public.config WHERE key = 'case_counter';

  v_year := (v_counter->>'year')::int;
  v_next := (v_counter->>'next')::int;

  -- If it's a new year, the next number would reset to 1
  IF v_year < v_cur_year THEN
    v_year := v_cur_year;
    v_next := 1;
  END IF;

  RETURN v_year || '-' || LPAD(v_next::text, 3, '0');
END;
$$;

-- Atomic claim: increments the counter and returns the assigned number
CREATE OR REPLACE FUNCTION public.claim_next_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_next int;
  v_cur_year int := extract(year from now())::int;
  v_counter jsonb;
  v_result text;
BEGIN
  -- Lock the row for atomic increment
  SELECT value INTO v_counter FROM public.config WHERE key = 'case_counter' FOR UPDATE;

  v_year := (v_counter->>'year')::int;
  v_next := (v_counter->>'next')::int;

  -- Year rollover: reset sequence on new year
  IF v_year < v_cur_year THEN
    v_year := v_cur_year;
    v_next := 1;
  END IF;

  v_result := v_year || '-' || LPAD(v_next::text, 3, '0');

  -- Persist incremented counter
  UPDATE public.config
    SET value = jsonb_build_object('year', v_year, 'next', v_next + 1)
    WHERE key = 'case_counter';

  RETURN v_result;
END;
$$;

-- Grant execute to all roles PostgREST uses
GRANT EXECUTE ON FUNCTION public.peek_next_case_number() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_case_number() TO anon, authenticated, service_role;

-- Signal PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- FIX 3 — system_logs: permanent forensic records
-- Not FK-linked to any table so records survive deletions.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type   text        NOT NULL,
  payload    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_logs' AND policyname = 'system_logs_select_admin'
  ) THEN
    CREATE POLICY "system_logs_select_admin"
      ON public.system_logs FOR SELECT TO authenticated
      USING (get_my_role() = 'admin');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'system_logs' AND policyname = 'system_logs_insert_authenticated'
  ) THEN
    CREATE POLICY "system_logs_insert_authenticated"
      ON public.system_logs FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END $$;


-- ============================================================
-- FIX 4 — Storage bucket 'contracts' + RLS policies
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'contracts_select_authenticated'
  ) THEN
    CREATE POLICY "contracts_select_authenticated"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'contracts');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'contracts_insert_coord_admin'
  ) THEN
    CREATE POLICY "contracts_insert_coord_admin"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'contracts'
        AND public.get_my_role() IN ('admin', 'coordinator')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'contracts_update_coord_admin'
  ) THEN
    CREATE POLICY "contracts_update_coord_admin"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'contracts'
        AND public.get_my_role() IN ('admin', 'coordinator')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
      AND policyname = 'contracts_delete_admin'
  ) THEN
    CREATE POLICY "contracts_delete_admin"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'contracts'
        AND public.get_my_role() = 'admin'
      );
  END IF;
END $$;
