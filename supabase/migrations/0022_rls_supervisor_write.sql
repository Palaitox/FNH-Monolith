-- ============================================================
-- Migration 0022 — Add supervisor to all coordinator-level RLS write policies
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
--
-- When the 'supervisor' role was added in migration 0017, all write policies
-- created in 0004_rls.sql, 0011_contract_cases.sql, and 0016_employee_leaves.sql
-- still listed only ('admin', 'coordinator'). Supervisors need the same write
-- access as coordinators on all operational tables. Without this fix, any
-- INSERT/UPDATE from a supervisor session fails with an RLS violation — which
-- Next.js surfaces as "An error occurred in the Server Components render."
-- ============================================================

-- ── employees ──────────────────────────────────────────────
DROP POLICY IF EXISTS "employees_insert_coord_admin" ON public.employees;
CREATE POLICY "employees_insert_coord_admin"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "employees_update_coord_admin" ON public.employees;
CREATE POLICY "employees_update_coord_admin"
  ON public.employees FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── contract_cases ─────────────────────────────────────────
DROP POLICY IF EXISTS "cases_insert_coord_admin" ON public.contract_cases;
CREATE POLICY "cases_insert_coord_admin"
  ON public.contract_cases FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "cases_update_coord_admin" ON public.contract_cases;
CREATE POLICY "cases_update_coord_admin"
  ON public.contract_cases FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── contract_documents ─────────────────────────────────────
DROP POLICY IF EXISTS "documents_insert_coord_admin" ON public.contract_documents;
CREATE POLICY "documents_insert_coord_admin"
  ON public.contract_documents FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "documents_update_coord_admin" ON public.contract_documents;
CREATE POLICY "documents_update_coord_admin"
  ON public.contract_documents FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── contract_audit_logs ────────────────────────────────────
DROP POLICY IF EXISTS "audit_insert_coord_admin" ON public.contract_audit_logs;
CREATE POLICY "audit_insert_coord_admin"
  ON public.contract_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── employee_leaves ────────────────────────────────────────
DROP POLICY IF EXISTS "leaves_write_coord_admin" ON public.employee_leaves;
CREATE POLICY "leaves_write_coord_admin"
  ON public.employee_leaves FOR ALL
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── vehicles ───────────────────────────────────────────────
DROP POLICY IF EXISTS "vehicles_insert_coord_admin" ON public.vehicles;
CREATE POLICY "vehicles_insert_coord_admin"
  ON public.vehicles FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "vehicles_update_coord_admin" ON public.vehicles;
CREATE POLICY "vehicles_update_coord_admin"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── drivers ────────────────────────────────────────────────
DROP POLICY IF EXISTS "drivers_insert_coord_admin" ON public.drivers;
CREATE POLICY "drivers_insert_coord_admin"
  ON public.drivers FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "drivers_update_coord_admin" ON public.drivers;
CREATE POLICY "drivers_update_coord_admin"
  ON public.drivers FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── verification_pairs ─────────────────────────────────────
DROP POLICY IF EXISTS "pairs_insert_coord_admin" ON public.verification_pairs;
CREATE POLICY "pairs_insert_coord_admin"
  ON public.verification_pairs FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

DROP POLICY IF EXISTS "pairs_update_coord_admin" ON public.verification_pairs;
CREATE POLICY "pairs_update_coord_admin"
  ON public.verification_pairs FOR UPDATE
  TO authenticated
  USING  (get_my_role() IN ('admin', 'coordinator', 'supervisor'))
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── driver_document_events ─────────────────────────────────
DROP POLICY IF EXISTS "dde_insert_coord_admin" ON public.driver_document_events;
CREATE POLICY "dde_insert_coord_admin"
  ON public.driver_document_events FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));

-- ── vehicle_document_events ────────────────────────────────
DROP POLICY IF EXISTS "vde_insert_coord_admin" ON public.vehicle_document_events;
CREATE POLICY "vde_insert_coord_admin"
  ON public.vehicle_document_events FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('admin', 'coordinator', 'supervisor'));
