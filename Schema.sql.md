# FNH Monolith — Authoritative Database Schema

> **Last updated:** 2026-04-09
> **Applied migrations:** 0001_initial.sql, 0002_extend_contracts.sql, 0003_seed_document_requirements.sql, 0004_rls.sql, 0005_storage_policies.sql, 0006_update_vehicle_requirements.sql, 0007_servitrans_driver_requirements.sql, 0008_employees_softdelete.sql, 0009_users_softdelete.sql, 0010_drop_contract_templates.sql, 0011_contract_cases.sql
> **Source of truth:** Supabase Dashboard → Table Editor
> This file must be kept in sync with every new migration.

---

## Complete Schema (post-migration-0011)

```sql
-- ============================================================
-- SHARED KERNEL
-- ============================================================

create table users (
  id             uuid        primary key references auth.users,
  name           text        not null,
  role           text        not null check (role in ('admin', 'coordinator', 'viewer')),
  email          text,                    -- stored at invite time (migration 0009, ND-32)
  deactivated_at timestamptz              -- soft-delete (migration 0009, ND-32)
);

create table system_logs (
  id         uuid        primary key default gen_random_uuid(),
  log_type   text        not null check (log_type in ('server_action', 'cron', 'notification')),
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONTRACTS MODULE
-- ============================================================

-- contract_templates table DROPPED by migration 0010 (ND-35).
-- Contracts are now generated natively via @react-pdf/renderer — no .docx files.

create table employees (
  id                 uuid        primary key default gen_random_uuid(),
  full_name          text        not null,
  cedula             text        not null unique,
  ciudad_cedula      text,                     -- city where the cédula was issued (migration 0015)
  -- Operational fields added in migration 0002 (position dropped)
  cargo              text,
  telefono           text,
  correo             text,
  salario_base       numeric(12,2),
  auxilio_transporte numeric(12,2) not null default 0,
  jornada_laboral    text         not null default 'tiempo_completo'
                     check (jornada_laboral in ('tiempo_completo', 'medio_tiempo', 'prestacion_servicios')),
  deactivated_at     timestamptz,           -- soft-delete (migration 0008, ND-29)
  created_at         timestamptz  not null default now()
);

create table contracts (
  id               uuid        primary key default gen_random_uuid(),
  employee_id      uuid        not null references employees(id),
  template_id      uuid,       -- FK dropped and column made nullable in migration 0010 (ND-35)
  -- status renamed to estado in migration 0002
  estado           text        not null check (estado in ('generated', 'signed')),
  -- Legacy fields added in migration 0002
  contract_number  text,       -- format: YYYY-NNN (e.g. 2026-001)
  tipo_contrato    text,
  fecha_inicio     date,
  fecha_terminacion date,
  forma_pago       text,
  -- Storage paths
  docx_path        text,
  pdf_path         text,
  pdf_hash         text,       -- SHA-256 hex of stored PDF
  pdf_filename     text,
  generated_at     timestamptz not null default now(),
  signed_at        timestamptz
);

-- Audit log for contract actions (upload, replace, remove, sign)
-- user_id is a soft reference (no FK) — audit records survive user deletion
create table contract_audit_logs (
  id          uuid        primary key default gen_random_uuid(),
  contract_id uuid        not null references public.contracts(id) on delete cascade,
  user_id     uuid,       -- soft ref: no FK, survives user deletion
  user_email  text,
  action      text        not null,
  details     jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Global key-value configuration store
create table config (
  key   text  primary key,
  value jsonb not null default '{}'
);

-- ============================================================
-- BUSES MODULE — ENTITIES
-- ============================================================

create table vehicles (
  id             uuid        primary key default gen_random_uuid(),
  plate          text        not null unique,
  type           text        not null check (type in ('titular', 'reemplazo')),
  deactivated_at timestamptz,
  created_at     timestamptz not null default now()
);

create table drivers (
  id             uuid        primary key default gen_random_uuid(),
  full_name      text        not null,
  cedula         text        not null unique,
  deactivated_at timestamptz,
  created_at     timestamptz not null default now()
);

create table verification_pairs (
  id             uuid        primary key default gen_random_uuid(),
  vehicle_id     uuid        not null references vehicles(id),
  driver_id      uuid        not null references drivers(id),
  verified_at    timestamptz not null,
  verified_by    uuid        references users(id),
  deactivated_at timestamptz,
  created_at     timestamptz not null default now()
);

-- ============================================================
-- BUSES MODULE — DOCUMENT REQUIREMENTS
-- ============================================================

create table document_requirements (
  id             uuid    primary key default gen_random_uuid(),
  name           text    not null,
  category       text    not null check (category in ('driver', 'vehicle')),
  has_expiry     boolean not null default true,
  effective_from date    not null default current_date,
  effective_to   date
);

-- ============================================================
-- BUSES MODULE — DOCUMENT EVENT LOGS (append-only)
-- ============================================================

create table driver_document_events (
  id              uuid        primary key default gen_random_uuid(),
  driver_id       uuid        not null references drivers(id),
  requirement_id  uuid        not null references document_requirements(id),
  expiry_date     date,
  is_illegible    boolean     not null default false,
  computed_status text        not null check (computed_status in
                              ('Vigente', 'Seguimiento', 'Alerta', 'Crítico')),
  previous_status text        check (previous_status in
                              ('Vigente', 'Seguimiento', 'Alerta', 'Crítico')),
  recorded_at     timestamptz not null default now(),
  recorded_by     uuid        references users(id)
  -- recorded_by IS NULL means the row was written by the cron job
);

create table vehicle_document_events (
  id              uuid        primary key default gen_random_uuid(),
  vehicle_id      uuid        not null references vehicles(id),
  requirement_id  uuid        not null references document_requirements(id),
  expiry_date     date,
  is_illegible    boolean     not null default false,
  computed_status text        not null check (computed_status in
                              ('Vigente', 'Seguimiento', 'Alerta', 'Crítico')),
  previous_status text        check (previous_status in
                              ('Vigente', 'Seguimiento', 'Alerta', 'Crítico')),
  recorded_at     timestamptz not null default now(),
  recorded_by     uuid        references users(id)
  -- recorded_by IS NULL means the row was written by the cron job
);

-- ============================================================
-- BUSES MODULE — NOTIFICATIONS
-- ============================================================

create table notification_log (
  id              uuid        primary key default gen_random_uuid(),
  event_id        uuid        not null,
  event_table     text        not null check (event_table in
                              ('driver_document_events', 'vehicle_document_events')),
  alert_type      text        not null check (alert_type in ('Alerta', 'Crítico')),
  notified_at     timestamptz not null default now(),
  delivery_status text        not null check (delivery_status in
                              ('sent', 'failed', 'retrying')),
  failure_reason  text,
  retry_count     int         not null default 0
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Hot query path: current status per driver+requirement (ND-3)
create index idx_dde_driver_req_time
  on driver_document_events (driver_id, requirement_id, recorded_at desc);

-- Hot query path: current status per vehicle+requirement (ND-3)
create index idx_vde_vehicle_req_time
  on vehicle_document_events (vehicle_id, requirement_id, recorded_at desc);

-- Historical reconstruction: all events up to point T for a driver (Query A)
create index idx_dde_driver_time
  on driver_document_events (driver_id, recorded_at desc);

-- Historical reconstruction: all events up to point T for a vehicle (Query B)
create index idx_vde_vehicle_time
  on vehicle_document_events (vehicle_id, recorded_at desc);

-- Cron deduplication: one sent notification per (event, type, day) (ND-1)
-- AT TIME ZONE 'UTC' makes date_trunc IMMUTABLE (required for index expressions).
create unique index idx_notification_dedup
  on notification_log (event_id, event_table, alert_type, date_trunc('day', notified_at AT TIME ZONE 'UTC'))
  where delivery_status = 'sent';

-- Cron retry lookup: find failed/retrying rows efficiently
create index idx_notification_retry
  on notification_log (delivery_status, retry_count)
  where delivery_status in ('failed', 'retrying');

-- Requirement effectivity lookup
create index idx_req_effectivity
  on document_requirements (category, effective_from, effective_to);

-- Contract number uniqueness (partial — NULL contract_number is allowed)
create unique index idx_contracts_number
  on contracts (contract_number)
  where contract_number is not null;

-- Audit log lookup by contract
create index idx_audit_contract
  on contract_audit_logs (contract_id, created_at desc);

-- Active employees fast lookup (partial index on active set)
create index idx_employees_active
  on employees (full_name)
  where deactivated_at is null;

-- Active users fast lookup (partial index on active set, migration 0009)
create index idx_users_active
  on users (name)
  where deactivated_at is null;
```

---

## Migration History

| File | Applied | Summary |
|---|---|---|
| `0001_initial.sql` | 2026-03-29 | All base tables + indexes |
| `0002_extend_contracts.sql` | 2026-03-29 | employees extended (cargo, salary fields); contracts: status→estado + legacy fields; contract_audit_logs + config added |
| `0003_seed_document_requirements.sql` | 2026-03-30 | Initial driver (16) + vehicle (7) document requirements seeded |
| `0004_rls.sql` | 2026-03-30 | RLS enabled on all 13 tables; `get_my_role()` SECURITY DEFINER function (ND-16) |
| `0005_storage_policies.sql` | 2026-03-30 | `contracts` Storage bucket; read all-auth; write/delete scoped by role |
| `0006_update_vehicle_requirements.sql` | 2026-04-01 | Hard DELETE: RCEC events + requirement, Tarjeta de propiedad events + requirement; RENAME RCC → "Seguro obligatorio (SOAT)"; INSERT "Certificado de revisión preventiva" |
| `0007_servitrans_driver_requirements.sql` | 2026-04-01 | Hard replace all driver requirements with SERVITRANS 16-item onboarding checklist: 15 `has_expiry=false` binary items + 1 `has_expiry=true` (Licencia de conducción C2) |
| `0008_employees_softdelete.sql` | 2026-04-02 | ADD COLUMN `deactivated_at timestamptz` to `employees`; CREATE partial index `idx_employees_active` on active employees (ND-29) |
| `0009_users_softdelete.sql` | 2026-04-03 | ADD COLUMN `email text` and `deactivated_at timestamptz` to `public.users`; CREATE partial index `idx_users_active`; CREATE POLICY `users_delete_admin` (ND-32) |
| `0010_drop_contract_templates.sql` | 2026-04-03 | DROP FK `contracts_template_id_fkey`; ALTER `contracts.template_id` to nullable; DROP TABLE `contract_templates` (ND-35) |
| `0011_contract_cases.sql` | 2026-04-09 | DROP TABLE `contracts`; CREATE `contract_cases` (expediente) + `contract_documents` (each signable piece); ALTER `contract_audit_logs`: replace `contract_id` with `document_id`; RLS for new tables (ND-45) |
