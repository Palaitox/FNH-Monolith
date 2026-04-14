-- ============================================================
-- FNH MONOLITH — Migration 0014: Gap-filling case numbering
--
-- Replaces the config-counter approach with pure table-derived
-- numbering. claim_next_case_number() fills gaps before MAX+1:
--
--   existing {001, 003, 004} → next = 002  (fills gap)
--   existing {001, 002, 003} → next = 004  (no gap, MAX+1)
--   existing {}              → next = 001
--
-- Concurrency: pg_advisory_xact_lock serializes concurrent
-- claims within the same transaction scope.
--
-- The old sync trigger and config counter are no longer needed.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ============================================================
-- STEP 1 — Drop the delete-sync trigger (no longer needed)
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_case_counter ON public.contract_cases;
DROP FUNCTION IF EXISTS public.sync_case_counter_on_delete();


-- ============================================================
-- STEP 2 — peek_next_case_number: read-only preview for the UI
-- Returns what the next number would be (fills lowest gap first).
-- ============================================================

CREATE OR REPLACE FUNCTION public.peek_next_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := extract(year from now())::int;
  v_max  int;
  v_gap  int;
BEGIN
  SELECT COALESCE(MAX(SPLIT_PART(case_number, '-', 2)::int), 0)
  INTO v_max
  FROM public.contract_cases
  WHERE case_number LIKE (v_year::text || '-%');

  -- Find lowest missing number in the sequence 1..MAX
  SELECT s.n INTO v_gap
  FROM generate_series(1, v_max) AS s(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contract_cases
    WHERE case_number = v_year::text || '-' || LPAD(s.n::text, 3, '0')
  )
  ORDER BY s.n
  LIMIT 1;

  RETURN v_year::text || '-' || LPAD(COALESCE(v_gap, v_max + 1)::text, 3, '0');
END;
$$;


-- ============================================================
-- STEP 3 — claim_next_case_number: atomic, gap-filling
-- Uses an advisory lock to serialize concurrent claims.
-- ============================================================

CREATE OR REPLACE FUNCTION public.claim_next_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := extract(year from now())::int;
  v_max  int;
  v_gap  int;
BEGIN
  -- Serialize concurrent contract creations
  PERFORM pg_advisory_xact_lock(hashtext('claim_next_case_number'));

  SELECT COALESCE(MAX(SPLIT_PART(case_number, '-', 2)::int), 0)
  INTO v_max
  FROM public.contract_cases
  WHERE case_number LIKE (v_year::text || '-%');

  -- Fill lowest gap first
  SELECT s.n INTO v_gap
  FROM generate_series(1, v_max) AS s(n)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contract_cases
    WHERE case_number = v_year::text || '-' || LPAD(s.n::text, 3, '0')
  )
  ORDER BY s.n
  LIMIT 1;

  RETURN v_year::text || '-' || LPAD(COALESCE(v_gap, v_max + 1)::text, 3, '0');
END;
$$;


-- ============================================================
-- STEP 4 — Grants + schema cache reload
-- ============================================================

GRANT EXECUTE ON FUNCTION public.peek_next_case_number() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_case_number() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
