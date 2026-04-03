# FNH Modular Monolith — Final System v4.5

> **Last updated:** 2026-04-02
> **Applied migrations:** 0001_initial.sql, 0002_extend_contracts.sql, 0003_seed_document_requirements.sql, 0004_rls.sql, 0005_storage_policies.sql, 0006_update_vehicle_requirements.sql, 0007_servitrans_driver_requirements.sql
> For the authoritative schema file see `Schema.sql.md`.

---

## 1. Complete PostgreSQL Schema

> This section reflects the post-migration-0002 state. See `Schema.sql.md` for the canonical, always-current version.

```sql
-- ============================================================
-- SHARED KERNEL
-- ============================================================

create table users (
  id    uuid primary key references auth.users,
  name  text not null,   -- NOTE: column is 'name', not 'full_name' (diverges from original migration draft)
  role  text not null check (role in ('admin', 'coordinator', 'viewer'))
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

create table contract_templates (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  storage_path text        not null,
  created_at   timestamptz not null default now()
);

create table employees (
  id                 uuid        primary key default gen_random_uuid(),
  full_name          text        not null,
  cedula             text        not null unique,
  -- Operational fields added in migration 0002 (position dropped)
  cargo              text,
  telefono           text,
  correo             text,
  salario_base       numeric(12,2),
  auxilio_transporte numeric(12,2) not null default 0,
  jornada_laboral    text         not null default 'tiempo_completo'
                     check (jornada_laboral in ('tiempo_completo', 'medio_tiempo', 'prestacion_servicios')),
  created_at         timestamptz  not null default now()
);

create table contracts (
  id               uuid        primary key default gen_random_uuid(),
  employee_id      uuid        not null references employees(id),
  template_id      uuid        not null references contract_templates(id),
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
-- user_id is a soft reference (no FK) — audit records survive user deletion (ND-10)
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
-- date_trunc('day', timestamptz) is STABLE (timezone-dependent) and cannot be indexed.
-- Converting to timestamp first via AT TIME ZONE makes it deterministic.
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
```

---

## 2. Named Decisions Register

See `decisions.md.md` for the full register with rationale. Summary of IDs:

| ID | Decision |
|---|---|
| ND-1 | ~~Notification trigger: status transition OR (Alerta/Crítico AND no sent row today)~~ → **Superseded by ND-24** |
| ND-2 | ESLint boundaries plugin enforces module isolation at CI |
| ND-3 | No materialized view; DISTINCT ON + indexes for current status |
| ND-4 | Excel import is two-phase (parse+confirm+upsert) |
| ND-5 | No compliance_snapshots; GA-F-094 always reconstructed from events |
| ND-6 | Driver documents owned by Driver entity, not VerificationPair |
| ND-7 | verified_at is explicit user input; never auto-set to now() |
| ND-8 | No uniqueness on (vehicle_id, driver_id, verified_at) |
| ND-9 | SERVITRANS 16-doc onboarding checklist: 15 binary (`has_expiry=false`) + Licencia C2 (`has_expiry=true`) |
| ND-10 | contract_audit_logs.user_id is soft reference (no FK); audit records survive user deletion |
| ND-11 | xlsx replaced with @e965/xlsx fork (CVE: prototype pollution + ReDoS) |
| ND-12 | contract-gen.js and security.js converted to npm ES modules (CDN globals removed) |
| ND-13 | Middleware uses getClaims() (local JWT read) not getUser() (server round-trip) |
| ND-14 | DISTINCT ON replicated in application code (JS) — Supabase client does not support DISTINCT ON syntax |
| ND-15 | Cron skips (entity × requirement) pairs with no prior event row; initial entry is always manual |
| ND-16 | RLS role checks use `get_my_role() SECURITY DEFINER` to break circular dependency on `public.users` |
| ND-17 | `public.users` column is `name` (not `full_name`) — diverges from original migration draft |
| ND-18 | Single accent color (cyan `#38c8d8`), no gradients; `Geist Mono` for machine identifiers; dark mode default via `dark` class on `<html>` |
| ND-19 | Template deletion: Storage object removed first (best-effort, error swallowed) then DB row deleted |
| ND-20 | `"lint"` script uses `eslint .` (ESLint CLI flat config) not `next lint` |
| ND-21 | `ignoreRestSiblings: true` for `no-unused-vars` — handles `({ source, ...e }) => e` destructure-to-omit pattern |
| ND-22 | `computeStatus(expiryDate, hasExpiry, today)` — `hasExpiry=false` always returns `'Vigente'` |
| ND-23 | Compliance recomputes from source truth (`expiry_date` + `has_expiry`), not stored `computed_status` |
| ND-24 | Notification on Crítico transition only; no Alerta emails; no repeated-state emails; fires at record-time (manual entry) and cron (day-over-day) |
| ND-25 | SERVITRANS checklist is append-only; checked items cannot be unchecked; form only submits newly-checked items |
| ND-26 | `missingCount > 0` forces entity overall = `'Crítico'`; per-category reqMaps prevent cross-contamination |
| ND-27 | `deleteDriverAction` cascades in app code: events → pairs → driver (FK RESTRICT, no DB cascade) |

---

## 3. Historical Reconstruction Canonical Queries

These are the two authoritative queries used by `report-builder.ts`. Neither may be modified to filter by current state.

### Query A — Driver documents at verification time

```sql
SELECT DISTINCT ON (dde.requirement_id)
  dde.requirement_id,
  dr.name             AS requirement_name,
  dde.expiry_date,
  dde.is_illegible,
  dde.computed_status
FROM driver_document_events  dde
JOIN document_requirements   dr  ON dr.id  = dde.requirement_id
JOIN drivers                 d   ON d.id   = dde.driver_id
WHERE dde.driver_id        =  :driver_id
  AND dde.recorded_at     <= :verified_at
  AND dr.effective_from   <= :verified_at::date
  AND (dr.effective_to     IS NULL OR dr.effective_to  > :verified_at::date)
  AND (d.deactivated_at    IS NULL OR d.deactivated_at > :verified_at)
ORDER BY dde.requirement_id,
         dde.recorded_at DESC;
```

### Query B — Vehicle documents at verification time

```sql
SELECT DISTINCT ON (vde.requirement_id)
  vde.requirement_id,
  dr.name             AS requirement_name,
  vde.expiry_date,
  vde.is_illegible,
  vde.computed_status
FROM vehicle_document_events vde
JOIN document_requirements   dr  ON dr.id  = vde.requirement_id
JOIN vehicles                v   ON v.id   = vde.vehicle_id
WHERE vde.vehicle_id       =  :vehicle_id
  AND vde.recorded_at     <= :verified_at
  AND dr.effective_from   <= :verified_at::date
  AND (dr.effective_to     IS NULL OR dr.effective_to  > :verified_at::date)
  AND (v.deactivated_at    IS NULL OR v.deactivated_at > :verified_at)
ORDER BY vde.requirement_id,
         vde.recorded_at DESC;
```

**Parameters for both queries** — supplied by `report-builder.ts` from the `verification_pairs` row:

| Parameter | Source | Type |
|---|---|---|
| `:driver_id` | `verification_pairs.driver_id` | `uuid` |
| `:vehicle_id` | `verification_pairs.vehicle_id` | `uuid` |
| `:verified_at` | `verification_pairs.verified_at` | `timestamptz` |

---

## 4. Architecture and Module Structure

### Style: Modular Monolith on Next.js App Router

**Justification**: Internal tool with ≤ 50 concurrent users and a team too small to operate distributed services. Module boundaries are enforced structurally (directory isolation + ESLint) rather than by network.

### Directory Structure

```
lib/                            ← root-level (Next.js middleware helpers)
│   └── middleware.ts           ← updateSession() — refreshes session cookies,
│                                  auth gate via getClaims() (ND-13)
│
app/
├── (shared)/
│   ├── lib/
│   │   ├── db.ts               ← all Supabase query I/O; logContractAction included
│   │   ├── auth.ts             ← client factories + getUserClaims/getUserRole
│   │   └── notifications.ts    ← email dispatch (Resend)
│   └── components/             ← shared UI primitives
│
├── (app)/
│   ├── AppNav.tsx              ← 'use client'; nav: Panel / Contratos / Buses + sign out
│   └── layout.tsx              ← renders AppNav + children for pages inside (app)/
│
├── auth/
│   └── login/
│       └── page.tsx            ← login form (Supabase signInWithPassword)
│
├── contracts/
│   ├── actions/
│   │   ├── contracts.ts        ← 'use server': list, create, delete, attach PDF, import
│   │   └── verify-integrity.ts ← 'use server': SHA-256 via node:crypto
│   ├── components/
│   ├── lib/
│   │   ├── contract-gen.js     ← browser-only; npm ES module (ND-12)
│   │   ├── security.js         ← browser-only; npm ES module (ND-12)
│   │   └── excel-importer.ts   ← two-phase import (ND-4)
│   ├── new/
│   │   └── page.tsx            ← employee/template select → generate .docx → upload
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; contract + audit log
│   │   └── ContractDetail.tsx  ← 'use client'; PDF upload, integrity check, delete
│   ├── layout.tsx              ← thin AppNav wrapper (segment layout pattern)
│   ├── page.tsx                ← contract list
│   └── types.ts
│
├── buses/
│   ├── actions/
│   │   └── buses.ts            ← CRUD, record documents, compliance, report generation
│   ├── components/
│   │   └── StatusBadge.tsx     ← color-coded status badge
│   ├── lib/
│   │   ├── expiry-calculator.ts
│   │   ├── compliance-checker.ts
│   │   └── report-builder.ts   ← executes Query A + Query B (DISTINCT ON in JS, ND-14)
│   ├── drivers/
│   │   ├── new/page.tsx
│   │   ├── [id]/page.tsx + DriverDetail.tsx
│   │   └── page.tsx
│   ├── vehicles/
│   │   ├── new/page.tsx
│   │   ├── [id]/page.tsx + VehicleDetail.tsx
│   │   └── page.tsx
│   ├── verification/
│   │   ├── new/page.tsx
│   │   ├── [id]/page.tsx
│   │   └── page.tsx
│   ├── layout.tsx              ← thin AppNav wrapper (segment layout pattern)
│   ├── page.tsx                ← buses hub
│   └── types.ts                ← GA_F_094_Report + all buses types
│
├── dashboard/
│   ├── layout.tsx              ← thin AppNav wrapper (segment layout pattern)
│   └── page.tsx                ← stats + role display
│
└── api/
    └── cron/
        └── route.ts
```

**Module boundary rule (ND-2)**: `contracts/` and `buses/` may import from `(shared)/` only. Enforced by `eslint-plugin-boundaries` in CI.

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `lib/middleware.ts` | Session cookie refresh + getClaims() auth gate |
| `db.ts` | All Supabase query I/O; typed results; audit log writes |
| `auth.ts` | Supabase client factories (browser / server / service); claims + role extraction |
| `notifications.ts` | Email via Resend; returns `sent`/`failed` with reason |
| `contract-gen.js` | Browser-only: fills `.docx` template from variable map |
| `security.js` | Browser-only: SHA-256 compute/verify via `window.crypto.subtle` |
| `excel-importer.ts` | Parse `.xlsx` (pure, no DOM); validate; return `ExcelImportResult` |
| `verify-integrity.ts` | Server Action: re-download PDF, re-compute SHA-256, compare to stored hash |
| `expiry-calculator.ts` | Pure: `(expiry_date | null, today) → status` |
| `compliance-checker.ts` | Aggregate current document statuses for a VerificationPair |
| `report-builder.ts` | Execute Query A + B; assemble `GA_F_094_Report` |
| `api/cron/route.ts` | Daily batch: recalculate statuses, detect transitions, fire notifications, write system_logs |
| `(app)/AppNav.tsx` | Navigation shell; 'use client'; active link via usePathname; sign out via supabase.auth.signOut() |
| `*/layout.tsx` (segment wrappers) | Per-segment thin layouts injecting AppNav into dashboard/, contracts/, buses/ without moving page files |

### External Integrations

| Service | Purpose |
|---|---|
| Supabase PostgreSQL | All relational data |
| Supabase Storage | `.docx` templates, generated contracts, signed PDFs (bucket: `contracts`) |
| Supabase Auth | User sessions; JWT disabled (PUBLISHABLE_KEY + SECRET_KEY) |
| Vercel Cron | Daily trigger at `0 11 * * *` UTC (06:00 Colombia) |
| Resend | Transactional email; Alerta/Crítico notifications |

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   ← sb_publishable_... (browser-safe; JWT disabled)
SUPABASE_SECRET_KEY                    ← sb_secret_... (server-only; bypasses RLS)
CRON_SECRET                            ← 64-char hex; verified in cron Authorization header
RESEND_API_KEY
RESEND_FROM_EMAIL                      ← sender; "FNH <onboarding@resend.dev>" works on Resend free tier; verified domain required otherwise
NOTIFICATION_RECIPIENT                 ← comma-separated list of recipients for all Crítico-transition alerts (5 addresses configured in production)
```

> All 7 env vars are set in Vercel production. `notifications.ts` parses `NOTIFICATION_RECIPIENT` as `split(',').map(s => s.trim()).filter(Boolean)` and sends to all addresses.

---

## 5. Cron Execution Flow (Corrected)

### Pseudocode

```
cron_run():
  run_id = uuid()
  started_at = now()
  counts = { processed: 0, transitions: 0, notified: 0, failed: 0 }

  // Step 1 — query only active entities
  entities = db.query("""
    SELECT driver_id / vehicle_id, requirement_id, expiry_date
    FROM drivers / vehicles
    WHERE deactivated_at IS NULL
  """)

  for each (entity, requirement) in entities:
    counts.processed++

    // Step 2 — compute new status (pure function, no I/O)
    new_status = expiry_calculator(requirement.expiry_date, today)

    // Step 3 — fetch previous status from latest event row
    previous_status = db.latest_event(entity, requirement).computed_status

    // Step 4 — insert new event row unconditionally
    new_event_id = db.insert_event(entity, requirement, new_status, previous_status)
    counts.transitions++ if new_status != previous_status

    // Step 5 — Notification eligibility check (ND-24, replaces ND-1)
    // Only fire once: when a doc transitions INTO Crítico for the first time.
    // No Alerta emails. No repeated emails for persistent Crítico state.
    transitioned_to_critico = (new_status == 'Crítico' AND previous_status != 'Crítico')

    if transitioned_to_critico:
      result = notifications.send(recipients, 'Crítico', entity, requirement)
      db.insert_notification_log(
        event_id        = new_event_id,
        event_table     = <table>,
        alert_type      = 'Crítico',
        delivery_status = result.status,   // 'sent' | 'failed'
        failure_reason  = result.error,
        retry_count     = 0
      )
      if result.status == 'sent': counts.notified++
      else:                       counts.failed++
    // NOTE: manual record-time notifications are handled in recordDriverDocumentsAction
    // and recordVehicleDocumentsAction for born-Crítico documents (same transition rule)

  // Step 6 — retry pass for failed/retrying rows (retry_count < 3)
  pending = db.query("""
    SELECT * FROM notification_log
    WHERE delivery_status IN ('failed', 'retrying')
      AND retry_count < 3
  """)
  for each row in pending:
    result = notifications.send(...)
    db.update_notification_log(row.id,
      delivery_status = result.status,
      retry_count     = row.retry_count + 1
    )

  // Step 7 — write structured run log
  db.insert_system_logs(log_type='cron', payload={
    run_id, started_at, duration_ms, processed, transitions, notified, failed
  })
```

### Failure Recovery Properties

| Failure point | State on failure | Recovery on next run |
|---|---|---|
| Crash after event insert, before notification | Event row exists; no `notification_log` row | `should_notify` re-evaluates; inserts log if still eligible; dedup index is secondary guard |
| Crash mid-notification batch | Some notifications sent, some not | Retry pass picks up `failed`/`retrying` rows |
| Cron never fires | No new event rows for the day | `system_logs` has no entry; absence is detectable |
| Email provider down | `delivery_status = 'failed'` written | Retry pass (up to 3 attempts); after 3 failures, row persists for manual inspection |

---

## 6. Change Log

| Version | Change | Type |
|---|---|---|
| v4.0 | Initial final design document | New |
| v4.1 | Corrected ND-1 notification trigger condition; added Query B deactivation filter | Bug fix (Critical) |
| v4.2 | Schema updated to post-migration-0002 (employees extended, contracts extended, contract_audit_logs, config); idx_notification_dedup corrected with AT TIME ZONE 'UTC'; directory structure updated (lib/ root, audit.ts merged into db.ts, /auth/login route); env var names updated (PUBLISHABLE_KEY, SECRET_KEY); added ND-10 through ND-13 | Implementation alignment |
| v4.3 | Applied migration 0003 (document requirements seed); Phase 2 complete (buses module: all CRUD pages, expiry-calculator, compliance-checker, report-builder, StatusBadge); Phase 3 complete (cron route, notifications.ts, vercel.json); nav shell added ((app)/AppNav.tsx + segment layout wrappers); directory structure updated; added ND-14 and ND-15; RESEND_FROM_EMAIL and NOTIFICATION_RECIPIENT marked as pending | Implementation alignment |
| v4.4 | Phase 4 complete — RLS (0004_rls.sql) + Storage policies (0005_storage_policies.sql) + requireRole() in all mutation Server Actions + ESLint boundaries (eslint.config.mjs, eslint-plugin-boundaries pinned to 5.1.0) + Playwright E2E tests verified 17/17 (auth.setup, smoke, unauthenticated) + cron load-test seed (200 vehicles × reqs); added ND-16 (SECURITY DEFINER get_my_role()); noted public.users.name column divergence | Security hardening |
| v4.5 | Phase 5 complete — Full UI/UX redesign: OKLCH color tokens (globals.css), single cyan accent `#38c8d8`, near-black dark bg `oklch(0.08)`, dark mode default; Geist + Geist Mono typography (sans for UI, mono for identifiers/dates/hashes); redesigned AppNav, login, dashboard, contracts list/detail/new, buses hub/drivers/vehicles/verification (all list/detail/new pages); consistent labelClass/btnPrimary/btnSecondary/fieldClass patterns; StatusBadge updated to semitransparent borders; added ND-17, ND-18 | UI/UX |
| v4.6 | Phase 8 complete — Dashboard fleet compliance section (5-query batch, per-category reqMaps, missingCount); `computeStatus` hasExpiry param (ND-22); compliance recomputes from source truth (ND-23); SERVITRANS driver checklist migration 0007 (15 binary + 1 expiry); vehicle requirements cleanup migration 0006; `deleteDriverAction` cascade (ND-27); notification hardening: Crítico-transition-only emails at record-time + cron (ND-24); multi-recipient `NOTIFICATION_RECIPIENT`; middleware excludes `api/`; confirmed working on Vercel; added ND-22 through ND-27 | Feature + correctness | 
