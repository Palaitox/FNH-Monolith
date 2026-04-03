-- ============================================================
-- FNH MONOLITH — Clean vehicle document requirements
-- Migration: 0006_update_vehicle_requirements.sql
--
-- Hard cleanup — safe for early-setup databases with minimal data.
--
-- Changes:
--   1. Merge RCC + RCEC → "Pólizas contractual y extracontractual"
--   2. Merge "Licencia de tránsito" + "Tarjeta de propiedad"
--      → "Licencia de tránsito / Tarjeta de propiedad"
--   3. Add "Certificado de revisión preventiva" (vehicle, has_expiry)
--
-- For each merged pair:
--   - Events for the requirement being REMOVED are deleted first
--   - The requirement row is then deleted
--   - The remaining requirement is renamed (its events are preserved)
-- ============================================================

-- ── Step 1: Delete events for requirements being removed ─────────────────

-- Remove events for RCEC (being merged into RCC)
DELETE FROM vehicle_document_events
WHERE requirement_id IN (
  SELECT id FROM document_requirements
  WHERE name = 'Póliza responsabilidad civil extracontractual (RCEC)'
    AND category = 'vehicle'
);

-- Remove events for "Tarjeta de propiedad" (being merged into "Licencia de tránsito")
DELETE FROM vehicle_document_events
WHERE requirement_id IN (
  SELECT id FROM document_requirements
  WHERE name = 'Tarjeta de propiedad'
    AND category = 'vehicle'
);

-- ── Step 2: Delete the merged-away requirement rows ───────────────────────

DELETE FROM document_requirements
WHERE name = 'Póliza responsabilidad civil extracontractual (RCEC)'
  AND category = 'vehicle';

DELETE FROM document_requirements
WHERE name = 'Tarjeta de propiedad'
  AND category = 'vehicle';

-- ── Step 3: Rename the surviving requirements ─────────────────────────────

UPDATE document_requirements
SET name = 'Pólizas contractual y extracontractual'
WHERE name = 'Póliza responsabilidad civil contractual (RCC)'
  AND category = 'vehicle';

UPDATE document_requirements
SET name = 'Licencia de tránsito / Tarjeta de propiedad'
WHERE name = 'Licencia de tránsito'
  AND category = 'vehicle';

-- ── Step 4: Insert new requirement ───────────────────────────────────────

INSERT INTO document_requirements (name, category, has_expiry, effective_from)
SELECT 'Certificado de revisión preventiva', 'vehicle', true, current_date
WHERE NOT EXISTS (
  SELECT 1 FROM document_requirements
  WHERE name = 'Certificado de revisión preventiva' AND category = 'vehicle'
);
