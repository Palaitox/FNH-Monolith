-- ============================================================
-- FNH MONOLITH — INITIAL SCHEMA
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- Dependency order:
--   1. users (references auth.users — Supabase-managed)
--   2. system_logs
--   3. contract_templates
--   4. employees
--   5. contracts (→ employees, contract_templates)
--   6. vehicles
--   7. drivers
--   8. verification_pairs (→ vehicles, drivers, users)
--   9. document_requirements
--  10. driver_document_events (→ drivers, document_requirements, users)
--  11. vehicle_document_events (→ vehicles, document_requirements, users)
--  12. notification_log
--  13. Indexes
-- ============================================================

-- ============================================================
-- 1. SHARED KERNEL
-- ============================================================

create table users (
  id    uuid primary key references auth.users,
  name  text not null,
  role  text not null check (role in ('admin', 'coordinator', 'viewer'))
);

create table system_logs (
  id         uuid        primary key default gen_random_uuid(),
  log_type   text        not null check (log_type in ('server_action', 'cron', 'notification')),
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. CONTRACTS MODULE
-- ============================================================

create table contract_templates (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  storage_path text        not null,
  created_at   timestamptz not null default now()
);

create table employees (
  id         uuid        primary key default gen_random_uuid(),
  full_name  text        not null,
  cedula     text        not null unique,
  position   text,
  created_at timestamptz not null default now()
);

create table contracts (
  id           uuid        primary key default gen_random_uuid(),
  employee_id  uuid        not null references employees(id),
  template_id  uuid        not null references contract_templates(id),
  status       text        not null check (status in ('generated', 'signed')),
  docx_path    text,
  pdf_path     text,
  pdf_hash     text,
  generated_at timestamptz not null default now(),
  signed_at    timestamptz
);

-- ============================================================
-- 3. BUSES MODULE — ENTITIES
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
-- 4. BUSES MODULE — DOCUMENT REQUIREMENTS
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
-- 5. BUSES MODULE — DOCUMENT EVENT LOGS (append-only)
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
-- 6. BUSES MODULE — NOTIFICATIONS
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
-- 7. INDEXES
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
-- Hard guard against double-fire duplicate emails.
-- AT TIME ZONE 'UTC' converts timestamptz → timestamp, making date_trunc IMMUTABLE
-- (required for index expressions in PostgreSQL).
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
