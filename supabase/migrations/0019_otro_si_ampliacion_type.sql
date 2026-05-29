-- ============================================================
-- Migration 0019 — OTRO_SI_AMPLIACION document type
-- Apply via: Supabase Dashboard → SQL Editor (project qolnrtoznrgiedyhffbn)
-- Applied: 2026-05-26
--
-- Adds OTRO_SI_AMPLIACION as a valid document_type value.
-- OTRO_SI          — Otro Sí de modificación (e.g. cambio de fecha de pago)
-- OTRO_SI_AMPLIACION — Otro Sí de ampliación de término fijo (3-page template:
--                      págs 1-2 acuerdo de ampliación + pág 3 preaviso vencimiento)
--
-- affects_term = true only for OTRO_SI_AMPLIACION (it changes current_end_date).
-- OTRO_SI (payment date change) does not affect the contract term.
-- ============================================================

ALTER TABLE contract_documents
  DROP CONSTRAINT IF EXISTS contract_documents_document_type_check;

ALTER TABLE contract_documents
  ADD CONSTRAINT contract_documents_document_type_check
  CHECK (document_type IN ('INICIAL', 'PRORROGA', 'OTRO_SI', 'OTRO_SI_AMPLIACION', 'TERMINACION'));
