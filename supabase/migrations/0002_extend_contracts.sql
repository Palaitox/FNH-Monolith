-- ============================================================
-- FNH MONOLITH — MIGRATION 0002 (idempotent)
-- Extends employees and contracts to match legacy field names.
-- Adds contract_audit_logs and config tables.
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Safe to run multiple times.
-- ============================================================

-- ============================================================
-- employees: drop position, add operational fields
-- ============================================================

ALTER TABLE public.employees DROP COLUMN IF EXISTS position;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS cargo              text,
  ADD COLUMN IF NOT EXISTS telefono           text,
  ADD COLUMN IF NOT EXISTS correo             text,
  ADD COLUMN IF NOT EXISTS salario_base       numeric(12,2),
  ADD COLUMN IF NOT EXISTS auxilio_transporte numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jornada_laboral    text          NOT NULL DEFAULT 'tiempo_completo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_jornada_check'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_jornada_check
      CHECK (jornada_laboral IN ('tiempo_completo', 'medio_tiempo', 'prestacion_servicios'));
  END IF;
END $$;

-- ============================================================
-- contracts: rename status → estado, add legacy fields
-- ============================================================

DO $$
BEGIN
  -- Rename only if status column still exists (idempotent)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'contracts'
      AND column_name  = 'status'
  ) THEN
    -- Drop the check constraint (name varies — drop all check constraints on status)
    ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
    ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_status_check1;
    ALTER TABLE public.contracts RENAME COLUMN status TO estado;
    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_estado_check
      CHECK (estado IN ('generated', 'signed'));
  END IF;
END $$;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS contract_number   text,
  ADD COLUMN IF NOT EXISTS tipo_contrato     text,
  ADD COLUMN IF NOT EXISTS fecha_inicio      date,
  ADD COLUMN IF NOT EXISTS fecha_terminacion date,
  ADD COLUMN IF NOT EXISTS forma_pago        text,
  ADD COLUMN IF NOT EXISTS pdf_filename      text;

-- Partial unique index on contract_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'contracts'
      AND indexname  = 'idx_contracts_number'
  ) THEN
    CREATE UNIQUE INDEX idx_contracts_number
      ON public.contracts (contract_number)
      WHERE contract_number IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- contract_audit_logs
-- NOTE: user_id is a soft reference (no FK) so audit records
--       survive user deletion.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contract_audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id     uuid,
  user_email  text,
  action      text        NOT NULL,
  details     jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'contract_audit_logs'
      AND indexname  = 'idx_audit_contract'
  ) THEN
    CREATE INDEX idx_audit_contract
      ON public.contract_audit_logs (contract_id, created_at DESC);
  END IF;
END $$;

-- ============================================================
-- config (global key-value store for app settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.config (
  key   text  PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'
);
