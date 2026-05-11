-- ============================================================
-- Migration 0018 — firma_trabajador + firma_representante
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
--
-- Stores both signatures as base64 PNG text alongside the document.
-- firma_trabajador — filled by coordinator when worker signs (digital pad flow)
-- firma_representante — filled by supervisor when legal rep signs
--
-- Both are nullable: manual PDF uploads won't have firma_trabajador.
-- The PDF generator uses whatever is available; missing = blank placeholder box.
-- ============================================================

ALTER TABLE contract_documents
  ADD COLUMN firma_trabajador    text,
  ADD COLUMN firma_representante text;
