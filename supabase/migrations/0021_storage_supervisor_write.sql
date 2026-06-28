-- ============================================================
-- Migration 0021 — Storage write access for supervisor role
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
--
-- The storage INSERT/UPDATE policies created in 0005_storage_policies.sql
-- only allowed ('admin', 'coordinator') to write to contracts/pdf/ and
-- contracts/docx/. The 'supervisor' role was added in migration 0017 but
-- the storage policies were never updated.
--
-- The supervisor needs write access because attachRepresentativeSignatureAction
-- (ND-55) uploads the signed PDF from the browser using the supervisor's
-- session before calling the server action.
-- ============================================================

-- INSERT: add supervisor
DROP POLICY IF EXISTS "contracts_storage_insert_coord_admin" ON storage.objects;

CREATE POLICY "contracts_storage_insert_coord_admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] IN ('docx', 'pdf')
    AND public.get_my_role() IN ('admin', 'coordinator', 'supervisor')
  );

-- UPDATE: add supervisor
DROP POLICY IF EXISTS "contracts_storage_update_coord_admin" ON storage.objects;

CREATE POLICY "contracts_storage_update_coord_admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] IN ('docx', 'pdf')
    AND public.get_my_role() IN ('admin', 'coordinator', 'supervisor')
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] IN ('docx', 'pdf')
    AND public.get_my_role() IN ('admin', 'coordinator', 'supervisor')
  );
