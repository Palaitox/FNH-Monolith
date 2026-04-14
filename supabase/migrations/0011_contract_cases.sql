-- ============================================================
-- FNH MONOLITH — Migration 0011: Contract Cases (Expediente Model)
-- ND-45
--
-- Replaces the flat `contracts` table with a two-level model:
--   contract_cases     — expediente contractual (groups related documents)
--   contract_documents — each signable piece (INICIAL, PRORROGA, OTRO_SI, TERMINACION)
--
-- All data in `contracts` is test data — safe to truncate and drop.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ============================================================
-- STEP 1 — Clear test data and remove old FK so we can drop contracts
-- ============================================================

TRUNCATE TABLE public.contract_audit_logs;

ALTER TABLE public.contract_audit_logs
  DROP CONSTRAINT IF EXISTS contract_audit_logs_contract_id_fkey;

ALTER TABLE public.contract_audit_logs
  DROP COLUMN IF EXISTS contract_id;


-- ============================================================
-- STEP 2 — Drop old contracts table (policies, indexes, then table)
-- ============================================================

DROP POLICY IF EXISTS "contracts_select_all"        ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert_coord_admin" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update_coord_admin" ON public.contracts;
DROP POLICY IF EXISTS "contracts_delete_admin"       ON public.contracts;

DROP INDEX IF EXISTS public.idx_contracts_number;

DROP TABLE IF EXISTS public.contracts;


-- ============================================================
-- STEP 3 — contract_cases: expediente contractual por empleado
-- One case per employment cycle. Groups the initial contract and
-- all subsequent amendments (prórrogas, otrosíes, terminación).
-- ============================================================

CREATE TABLE public.contract_cases (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      uuid        NOT NULL REFERENCES public.employees(id),
  case_number      text        NOT NULL,   -- format: YYYY-NNN (e.g. 2026-001)
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'closed')),
  current_end_date date,                   -- updated when a signed doc modifies the term
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_case_number    ON public.contract_cases (case_number);
CREATE        INDEX idx_cases_employee ON public.contract_cases (employee_id, status);


-- ============================================================
-- STEP 4 — contract_documents: each signable document in a case
-- ============================================================

CREATE TABLE public.contract_documents (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           uuid        NOT NULL REFERENCES public.contract_cases(id) ON DELETE CASCADE,
  document_type     text        NOT NULL
                                CHECK (document_type IN ('INICIAL', 'PRORROGA', 'OTRO_SI', 'TERMINACION')),
  -- tipo_contrato only meaningful for INICIAL documents
  tipo_contrato     text,
  fecha_inicio      date,
  fecha_terminacion date,
  forma_pago        text,
  -- Whether this document modifies the contract end date (for vigencia calculation)
  affects_term      boolean     NOT NULL DEFAULT false,
  estado            text        NOT NULL DEFAULT 'generated'
                                CHECK (estado IN ('generated', 'signed')),
  pdf_path          text,
  pdf_hash          text,
  pdf_filename      text,
  generated_at      timestamptz NOT NULL DEFAULT now(),
  signed_at         timestamptz
);

CREATE INDEX idx_documents_case ON public.contract_documents (case_id, generated_at DESC);


-- ============================================================
-- STEP 5 — Wire contract_audit_logs to contract_documents
-- ============================================================

ALTER TABLE public.contract_audit_logs
  ADD COLUMN document_id uuid NOT NULL
    REFERENCES public.contract_documents(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_audit_contract;
CREATE INDEX idx_audit_document ON public.contract_audit_logs (document_id, created_at DESC);


-- ============================================================
-- STEP 6 — RLS for new tables (same pattern as old contracts)
-- ============================================================

-- contract_cases
ALTER TABLE public.contract_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cases_select_all"
  ON public.contract_cases FOR SELECT TO authenticated USING (true);

CREATE POLICY "cases_insert_coord_admin"
  ON public.contract_cases FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator'));

CREATE POLICY "cases_update_coord_admin"
  ON public.contract_cases FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator'));

CREATE POLICY "cases_delete_admin"
  ON public.contract_cases FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');


-- contract_documents
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_all"
  ON public.contract_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "documents_insert_coord_admin"
  ON public.contract_documents FOR INSERT TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator'));

CREATE POLICY "documents_update_coord_admin"
  ON public.contract_documents FOR UPDATE TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator'));

CREATE POLICY "documents_delete_admin"
  ON public.contract_documents FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');
