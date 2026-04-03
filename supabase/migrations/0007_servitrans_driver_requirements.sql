-- ============================================================
-- FNH MONOLITH — Replace driver document requirements
-- Migration: 0007_servitrans_driver_requirements.sql
--
-- Replaces the generic MinTransporte driver requirements with
-- the SERVITRANS onboarding checklist (16 documents).
-- Only "Licencia de conducción C2" has an expiry date.
-- All others are checklist items: present or not present.
--
-- Safe for early-setup databases (no important data to preserve).
-- ============================================================

-- Delete existing driver events first (FK constraint)
DELETE FROM driver_document_events
WHERE requirement_id IN (
  SELECT id FROM document_requirements WHERE category = 'driver'
);

-- Delete existing driver requirements
DELETE FROM document_requirements WHERE category = 'driver';

-- Insert SERVITRANS checklist requirements
INSERT INTO document_requirements (name, category, has_expiry, effective_from) VALUES
('Carta de autorización SERVITRANS',               'driver', false, current_date),
('Hoja de vida con foto azul',                     'driver', false, current_date),
('Fotocopia de cédula ampliada',                   'driver', false, current_date),
('RUT actualizado',                                'driver', false, current_date),
('Certificado de afiliación a EPS',                'driver', false, current_date),
('Certificado de afiliación a pensiones',          'driver', false, current_date),
('Certificado de afiliación a la ARL',             'driver', false, current_date),
('Certificado médico ocupacional (psicosensométrico completo)', 'driver', false, current_date),
('Planilla pago de seguridad social',              'driver', false, current_date),
('Certificado SIMIT (sin multas pendientes)',       'driver', false, current_date),
('Licencia de conducción C2',                      'driver', true,  current_date),
('Certificado de capacitación SST y seguridad vial','driver', false, current_date),
('Certificado Brigadista de Emergencia',           'driver', false, current_date),
('Antecedentes Policía',                           'driver', false, current_date),
('Registro Nacional de Medidas Correctivas (RNMC)','driver', false, current_date),
('Certificado de antecedentes Procuraduría',       'driver', false, current_date);
