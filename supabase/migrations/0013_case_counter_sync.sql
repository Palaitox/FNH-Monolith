-- ============================================================
-- FNH MONOLITH — Migration 0013: Case Counter Sync on Delete
--
-- Replaces the monotonic counter with a MAX+1 approach:
-- after any deletion from contract_cases, a trigger resets
-- the counter to MAX(existing) + 1 for the current year.
--
-- Effect: deleting the last case reclaims its number.
-- Deleting a middle case leaves a gap (unavoidable without
-- renumbering signed PDFs, which would break document integrity).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ============================================================
-- STEP 1 — Trigger function: sync counter after delete
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_case_counter_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := extract(year from now())::int;
  v_max  int;
BEGIN
  -- Find highest sequence number still existing for current year
  SELECT COALESCE(
    MAX(SPLIT_PART(case_number, '-', 2)::int),
    0
  )
  INTO v_max
  FROM public.contract_cases
  WHERE case_number LIKE (v_year::text || '-%');

  UPDATE public.config
  SET value = jsonb_build_object('year', v_year, 'next', v_max + 1)
  WHERE key = 'case_counter';

  RETURN OLD;
END;
$$;

-- ============================================================
-- STEP 2 — Attach trigger to contract_cases
-- ============================================================

DROP TRIGGER IF EXISTS trg_sync_case_counter ON public.contract_cases;

CREATE TRIGGER trg_sync_case_counter
  AFTER DELETE ON public.contract_cases
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.sync_case_counter_on_delete();

-- ============================================================
-- STEP 3 — Sync counter to current state of the table right now
-- ============================================================

DO $$
DECLARE
  v_year int := extract(year from now())::int;
  v_max  int;
BEGIN
  SELECT COALESCE(MAX(SPLIT_PART(case_number, '-', 2)::int), 0)
  INTO v_max
  FROM public.contract_cases
  WHERE case_number LIKE (v_year::text || '-%');

  UPDATE public.config
  SET value = jsonb_build_object('year', v_year, 'next', v_max + 1)
  WHERE key = 'case_counter';
END;
$$;

-- ============================================================
-- STEP 4 — Reload PostgREST schema cache
-- ============================================================

NOTIFY pgrst, 'reload schema';
