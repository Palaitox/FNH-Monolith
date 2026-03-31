-- ============================================================
-- FNH MONOLITH — Supabase Storage Policies
-- Apply via: Supabase Dashboard → SQL Editor → Run
--
-- Prerequisite: The 'contracts' bucket must exist.
-- This migration creates it if missing, then applies RLS policies.
--
-- Bucket structure:
--   contracts/templates/**   ← .docx templates; read: all auth; write: admin
--   contracts/docx/**        ← generated .docx contracts; read+write: coord+admin
--   contracts/pdf/**         ← signed PDF uploads; read+write: coord+admin
--
-- Storage policies use get_my_role() defined in 0004_rls.sql.
-- ============================================================

-- Create the bucket (private — no public URL access)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contracts',
  'contracts',
  false,
  52428800,  -- 50 MB per file
  array[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do nothing;


-- ============================================================
-- SELECT (download) policies
-- ============================================================

-- All authenticated users can read any file in the contracts bucket.
-- This covers template preview, generated .docx download, and PDF view.
create policy "contracts_storage_select_authenticated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'contracts'
  );


-- ============================================================
-- INSERT (upload) policies
-- ============================================================

-- Templates subfolder: admin only
create policy "contracts_storage_insert_templates_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = 'templates'
    and public.get_my_role() = 'admin'
  );

-- Generated .docx and signed PDFs: coordinator or admin
create policy "contracts_storage_insert_coord_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in ('docx', 'pdf')
    and public.get_my_role() in ('admin', 'coordinator')
  );


-- ============================================================
-- UPDATE (replace) policies
-- ============================================================

-- Templates: admin only
create policy "contracts_storage_update_templates_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = 'templates'
    and public.get_my_role() = 'admin'
  )
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = 'templates'
    and public.get_my_role() = 'admin'
  );

-- Generated contracts and PDFs: coordinator or admin
create policy "contracts_storage_update_coord_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in ('docx', 'pdf')
    and public.get_my_role() in ('admin', 'coordinator')
  )
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] in ('docx', 'pdf')
    and public.get_my_role() in ('admin', 'coordinator')
  );


-- ============================================================
-- DELETE policies
-- ============================================================

-- Admin only can delete files (all subfolders)
create policy "contracts_storage_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'contracts'
    and public.get_my_role() = 'admin'
  );
