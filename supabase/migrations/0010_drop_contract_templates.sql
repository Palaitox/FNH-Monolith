-- 0010_drop_contract_templates.sql
-- Phase 11: migrate from docx/templates to @react-pdf/renderer native PDF generation.
-- Templates are now code (contract-pdf.tsx), so the contract_templates table and the
-- contracts.template_id foreign key are no longer needed.

-- 1. Drop FK constraint so template_id becomes a free nullable column
--    (we keep the column to avoid breaking existing rows; it will be ignored by the app).
alter table contracts
  drop constraint if exists contracts_template_id_fkey;

alter table contracts
  alter column template_id drop not null;

-- 2. Drop the contract_templates table (and its storage-backed rows are obsolete too).
drop table if exists contract_templates;
