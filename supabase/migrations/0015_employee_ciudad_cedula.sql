-- ============================================================
-- FNH MONOLITH — Migration 0015: Employee ciudad_cedula
--
-- Adds the city where each employee's cédula was issued.
-- Used in employee profiles and populated in generated PDFs.
-- Nullable — existing rows default to NULL.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS ciudad_cedula text NULL;

NOTIFY pgrst, 'reload schema';
