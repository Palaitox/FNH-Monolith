-- 0009_users_softdelete.sql
-- Adds soft-delete support and email storage to public.users.
-- Enables the admin user-management module (ND-32, ND-33, ND-34).
--
-- Apply via: Supabase Dashboard → SQL Editor → Run

-- Add email column (stored at invite time for easy display without auth.admin join)
ALTER TABLE public.users ADD COLUMN email text;

-- Add soft-delete column (same pattern as employees, drivers, vehicles)
ALTER TABLE public.users ADD COLUMN deactivated_at timestamptz;

-- Partial index for fast active-user lookups
CREATE INDEX idx_users_active ON public.users (name) WHERE deactivated_at IS NULL;

-- Allow admin to hard-delete a user row (needed if invite is revoked before acceptance)
-- Soft-delete uses the existing users_update_admin policy (UPDATE sets deactivated_at).
CREATE POLICY "users_delete_admin"
  ON public.users FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');
  