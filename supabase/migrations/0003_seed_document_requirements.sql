-- ============================================================
-- FNH MONOLITH — Document Requirement Seeds
-- Migration: 0003_seed_document_requirements.sql
--
-- Seeds 16 driver + 7 vehicle document requirements.
-- Idempotent: skips insertion if rows already exist.
--
-- ⚠️  VERIFY THESE REQUIREMENTS MATCH YOUR ORGANIZATION'S
--     ACTUAL DOCUMENT CHECKLIST BEFORE RUNNING.
--     The list below is based on standard Colombian transport
--     ministry (MinTransporte) requirements for collective
--     passenger transport operators.
-- ============================================================

DO $$
BEGIN
  -- Only seed if the table is empty to avoid duplicates
  IF NOT EXISTS (SELECT 1 FROM document_requirements LIMIT 1) THEN

    -- ========================================================
    -- DRIVER DOCUMENTS (16)
    -- ========================================================
    INSERT INTO document_requirements (name, category, has_expiry, effective_from) VALUES

    -- Identity & licensing
    ('Cédula de ciudadanía',                   'driver', false, current_date),
    ('Licencia de conducción',                  'driver', true,  current_date),
    ('Tarjeta de operación del conductor',      'driver', true,  current_date),

    -- Health & aptitude
    ('Examen médico de aptitud psicofísica',    'driver', true,  current_date),
    ('Examen psicolaboral',                     'driver', true,  current_date),
    ('Certificado de alcoholismo y drogadicción','driver', true, current_date),
    ('Carné de vacunación',                     'driver', true,  current_date),

    -- Background checks
    ('Certificado de antecedentes penales',     'driver', true,  current_date),
    ('Certificado de antecedentes disciplinarios','driver', true, current_date),
    ('Certificado de antecedentes fiscales',    'driver', true,  current_date),
    ('Certificado de antecedentes de tránsito', 'driver', true,  current_date),

    -- Training
    ('Curso de capacitación en transporte',     'driver', true,  current_date),
    ('Certificado de manejo defensivo',         'driver', true,  current_date),

    -- Social security
    ('Planilla afiliación EPS',                 'driver', true,  current_date),
    ('Planilla afiliación AFP (pensión)',        'driver', true,  current_date),
    ('Planilla afiliación ARL',                 'driver', true,  current_date);

    -- ========================================================
    -- VEHICLE DOCUMENTS (7)
    -- ========================================================
    INSERT INTO document_requirements (name, category, has_expiry, effective_from) VALUES

    ('SOAT',                                             'vehicle', true,  current_date),
    ('Revisión técnico-mecánica y de gases',             'vehicle', true,  current_date),
    ('Tarjeta de operación',                             'vehicle', true,  current_date),
    ('Póliza responsabilidad civil contractual (RCC)',   'vehicle', true,  current_date),
    ('Póliza responsabilidad civil extracontractual (RCEC)', 'vehicle', true, current_date),
    ('Tarjeta de propiedad',                             'vehicle', false, current_date),
    ('Licencia de tránsito',                             'vehicle', false, current_date);

  END IF;
END $$;
