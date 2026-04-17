-- ============================================================
-- FNH MONOLITH — Migration 0016: Employee Leaves
--
-- Tracks maternity leave, disability, and other protected
-- leave periods for employees. A leave is "active" when:
--   start_date <= today AND
--   (actual_end_date IS NULL OR actual_end_date > today)
--
-- While on active leave, a "vencido" contract displays as
-- "en_licencia" — the employment relationship is protected
-- regardless of contract fecha_terminacion.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employee_leaves (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type        text        NOT NULL
                    CHECK (leave_type IN ('maternidad', 'paternidad', 'incapacidad', 'luto', 'otro')),
  start_date        date        NOT NULL,
  expected_end_date date,
  actual_end_date   date,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_leaves ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_leaves' AND policyname = 'leaves_select_authenticated'
  ) THEN
    CREATE POLICY "leaves_select_authenticated"
      ON public.employee_leaves FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'employee_leaves' AND policyname = 'leaves_write_coord_admin'
  ) THEN
    CREATE POLICY "leaves_write_coord_admin"
      ON public.employee_leaves FOR ALL TO authenticated
      USING (public.get_my_role() IN ('admin', 'coordinator'))
      WITH CHECK (public.get_my_role() IN ('admin', 'coordinator'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
