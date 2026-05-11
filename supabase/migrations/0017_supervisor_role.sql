-- ============================================================
-- Migration 0017 — Add 'supervisor' role
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
--
-- Supervisor sits between coordinator and admin:
--   - Full access to operational tables (employees, contracts, buses)
--   - Can approve / publish cargo_contract_texts proposals
--   - Cannot manage users or access admin panel (that is admin-only)
-- ============================================================

-- Update the CHECK constraint on users.role
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check,
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'coordinator', 'supervisor', 'viewer'));
