-- ============================================================
-- Migration 0020 — rol 'worker' y vínculo employees.user_id
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
--
-- Adds the 'worker' role for employees who will authenticate
-- before digitally signing their employment contracts.
--
-- workers:
--   - Have a user account but NO access to management features
--   - Only used for identity verification in the signing flow
--   - The WorkerVerificationModal verifies credentials in-memory
--     without disrupting the coordinator's active session
--
-- employees.user_id:
--   - Nullable FK to public.users — not all employees need an account
--   - 1-to-1: a user account can link to at most one employee
--   - ON DELETE SET NULL: deleting the user account un-links the employee
-- ============================================================

-- 1. Expand the role CHECK constraint to include 'worker'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'coordinator', 'viewer', 'worker'));

-- 2. Link employee to their user account (optional, 1-to-1)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id uuid
    UNIQUE
    REFERENCES public.users(id)
    ON DELETE SET NULL;
