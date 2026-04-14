# FNH Modular Monolith — Final System v5.1

## Quick Orientation

**Qué es esto:** Monolito modular Next.js 15 para gestión de contratos, empleados y flota de buses de Fundación Nuevo Horizonte.

**Orden de lectura para una sesión nueva:**
1. `docs/session-handoff.md` — estado operativo inmediato (qué se hizo, qué falta, qué no romper)
2. `implementation_plan.md.md` → sección "Current State Snapshot" — fase actual y pendientes
3. `decisions.md.md` — antes de cambiar cualquier comportamiento existente, verificar si hay una ND que lo explique
4. Este documento — solo si necesitas entender schema, componentes o flujos en detalle

**Rutas críticas (no tocar sin leer la ND correspondiente):**
- `middleware.ts` → ND-13 (getClaims vs getUser)
- `app/contracts/lib/contract-pdf.tsx` → ND-35, ND-36 (browser-only)
- `app/admin/actions/users.ts` → ND-42 (FK order en delete)
- `app/(shared)/lib/buses/report-builder.ts` → ND-14 (DISTINCT ON en JS)

**Fuentes de verdad:**
- Schema SQL canónico: `Schema.sql.md`
- Decisiones con rationale: `decisions.md.md`
- Estado de fases: `implementation_plan.md.md`

---

> **Last updated:** 2026-04-04
> **Applied migrations:** 0001_initial.sql, 0002_extend_contracts.sql, 0003_seed_document_requirements.sql, 0004_rls.sql, 0005_storage_policies.sql, 0006_update_vehicle_requirements.sql, 0007_servitrans_driver_requirements.sql, 0008_employees_softdelete.sql, 0009_users_softdelete.sql, 0010_drop_contract_templates.sql
> For the authoritative schema file see `Schema.sql.md`.

---

## 1. Complete PostgreSQL Schema

> This section reflects the post-migration-0002 state. See `Schema.sql.md` for the canonical, always-current version.

```sql
-- ============================================================
-- SHARED KERNEL
-- ============================================================

create table users (
  id             uuid        primary key references auth.users,
  name           text        not null,   -- NOTE: column is 'name', not 'full_name' (diverges from original migration draft)
  role           text        not null check (role in ('admin', 'coordinator', 'viewer')),
  email          text,                   -- stored at invite time (migration 0009, ND-32)
  deactivated_at timestamptz             -- soft-delete (migration 0009, ND-32)
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

-- contract_templates DROPPED by migration 0010 (ND-35).
-- Contracts are generated natively via @react-pdf/renderer — no .docx templates.

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
  deactivated_at     timestamptz,           -- soft-delete (migration 0008, ND-29)
  created_at         timestamptz  not null default now()
);

create table contracts (
  id               uuid        primary key default gen_random_uuid(),
  employee_id      uuid        not null references employees(id),
  template_id      uuid,       -- FK dropped and column made nullable by migration 0010 (ND-35)
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

-- Active employees fast lookup (partial index on active set)
create index idx_employees_active
  on employees (full_name)
  where deactivated_at is null;
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
| ND-28 | `Employee` type promoted to `(shared)/lib/employee-types.ts`; both `employees/` and `contracts/` import from shared (ND-2 compliance) |
| ND-29 | `employees.deactivated_at` soft-delete (migration 0008); hard delete admin-only and only when employee has zero contracts |
| ND-30 | `createEmployeeAction` uses explicit INSERT — cedula conflict surfaces as a legible error, never silently upserts |
| ND-31 | Flash-free theme: inline `<script>` in `<head>` reads localStorage before first paint; `suppressHydrationWarning` on `<html>`; `AppNav.tsx` owns toggle; `globals.css` sets `font-size: 115%` for accessibility |
| ND-32 | `public.users` gains `email` + `deactivated_at` columns (migration 0009); deactivation calls `signOut(id)` immediately; `getUserRole()` returns `null` for deactivated users |
| ND-33 | User invite via `supabase.auth.admin.inviteUserByEmail()`; rollback via `deleteUser()` if `public.users` INSERT fails (ND-33) |
| ND-34 | Self-protection: admin cannot change their own role or deactivate their own account; guard in both Server Action and UI |
| ND-35 | `contract_templates` table dropped (migration 0010); `@react-pdf/renderer` v4 generates PDFs natively; `pako` pinned to v1 via `package.json` overrides |
| ND-36 | `@react-pdf/renderer` and `signature_pad` are dynamically imported inside client event handlers — never at module level (SSR safety) |
| ND-37 | `ContractVars.firma?: string` (base64 PNG); `buildContractVars()` never sets it; callers merge externally; `SigSpace` component renders placeholder or embedded image |
| ND-38 | `ContractDetail` uses props directly (no `useState` wrappers); `router.refresh()` passes fresh server props through to the Client Component |
| ND-39 | "PDF firmado" section gated on `(isSignedState \|\| !!contract.pdf_path)` — hidden on pending contracts with no PDF |
| ND-40 | Mobile-first responsive layout: `px-4 py-6 sm:px-6` outer padding; hamburger nav below `md`; `overflow-x-auto` + `hidden sm:table-cell` on tables; `grid-cols-1 sm:grid-cols-2` for form grids; `flex-col sm:flex-row sm:items-center` for headers and info rows |
| ND-41 | Three iOS Safari restrictions patched: (1) blob URL `<a download>` navigates current page → skip download on mobile, DB write first; (2) `window.resize` on toolbar animation clears `signature_pad` → save/restore `pad.toData()`/`pad.fromData()`; (3) `window.open()` after `await` blocked as popup → open blank window synchronously, set `location.href` after async call |
| ND-42 | `deleteUserAction` hard-deletes a user: `public.users` first (FK order), then `auth.users` via Admin API (service client); self-deletion guard; two-click confirmation in `UserDetail.tsx` danger zone; navigates to `/admin` on success. `updateRoleAction` also uses service client. |
| ND-43 | Invite `redirectTo` points to `/auth/invite` (Client Component), not `/auth/callback` (route handler). Client Component reads `window.location.hash` for implicit-flow tokens (`access_token`/`refresh_token`) and calls `setSession()`; PKCE `code` query param handled as fallback via `exchangeCodeForSession()`. Always redirects to `/auth/set-password`. |

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
│   ├── AppNav.tsx              ← 'use client'; nav: Panel / Contratos / Empleados / Buses + sign out + light/dark toggle
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
│   │   ├── contract-pdf.tsx    ← BROWSER-ONLY; @react-pdf/renderer v4; 3 contract types + SigSpace (ND-35–37)
│   │   ├── pdf-vars.ts         ← ContractVars + buildContractVars(); firma?: string (ND-37)
│   │   ├── contract-gen.js     ← kept (ND-12); no longer used for generation
│   │   └── security.js         ← browser-only; SHA-256 via window.crypto.subtle (ND-12)
│   ├── new/
│   │   └── page.tsx            ← employee + tipo + dates → generate PDF → download → createContractAction → navigate
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; contract + audit log + employee
│   │   ├── ContractDetail.tsx  ← 'use client'; props-direct (ND-38); signature modal, PDF view, integrity check, delete; PDF section gated (ND-39)
│   │   └── SignatureModal.tsx  ← full-screen canvas; signature_pad v5 dynamic import; devicePixelRatio resize (ND-36)
│   ├── layout.tsx              ← thin AppNav wrapper (segment layout pattern)
│   ├── page.tsx                ← contract list
│   └── types.ts                ← re-exports Employee + JornadaLaboral from (shared); IntegrityResult; template_id: string | null
│
├── employees/
│   ├── actions/
│   │   └── employees.ts        ← 'use server': list, listAll, getById, create, update, deactivate, reactivate, delete, confirmImport
│   ├── lib/
│   │   └── excel-importer.ts   ← moved from contracts/lib; imports types from (shared) (ND-4)
│   ├── new/
│   │   └── page.tsx            ← create form; cedula uniqueness error surfaced (ND-30)
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; employee + contracts + role in parallel
│   │   └── EmployeeDetail.tsx  ← 'use client'; edit form, contracts list, deactivate/reactivate/delete danger zone
│   ├── import/
│   │   └── page.tsx            ← three-phase Excel import (upload → diff → confirm); back to /employees
│   ├── layout.tsx              ← thin AppNav wrapper (segment layout pattern)
│   ├── page.tsx                ← employee list: search, jornada filter, active/inactive toggle, 4 stats cards
│   └── types.ts                ← re-exports all types from (shared)/lib/employee-types
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
├── admin/
│   ├── actions/
│   │   └── users.ts            ← 'use server': listUsers, getUser, inviteUser, updateRole (service client, ND-42), deactivate, reactivate, deleteUser (ND-42); all require admin
│   ├── users/
│   │   ├── new/
│   │   │   └── page.tsx        ← invite form: name, email, role selector
│   │   └── [id]/
│   │       ├── page.tsx        ← Server Component; fetches user + claims in parallel
│   │       └── UserDetail.tsx  ← 'use client'; inline role editor, deactivate/reactivate/hard-delete with confirmation, self-guard (ND-34, ND-42)
│   ├── layout.tsx              ← redirects non-admin to /dashboard at layout level
│   ├── page.tsx                ← user list: 3 stats cards (activos/coordinadores/consultores), active table, collapsed inactive section
│   └── types.ts                ← AppUserRole, AppUser, ROLE_LABELS, ROLE_COLORS
│
├── auth/
│   ├── callback/
│   │   └── route.ts            ← PKCE code exchange → session → redirect to `next` param
│   ├── invite/
│   │   └── page.tsx            ← 'use client'; reads hash tokens (implicit flow) + PKCE fallback → /auth/set-password (ND-43)
│   ├── set-password/
│   │   └── page.tsx            ← 'use client'; set initial password for invited user → /dashboard
│   └── login/
│       └── page.tsx            ← Supabase signInWithPassword form
│
└── api/
    └── cron/
        └── route.ts
```

**Module boundary rule (ND-2)**: `contracts/`, `buses/`, `employees/`, and `admin/` may import from `(shared)/` only. Cross-module imports are forbidden. Enforced by `eslint-plugin-boundaries` in CI.

### Component Responsibilities

| Component | Responsibility |
|---|---|
| `lib/middleware.ts` | Session cookie refresh + getClaims() auth gate |
| `db.ts` | All Supabase query I/O; typed results; audit log writes |
| `auth.ts` | Supabase client factories (browser / server / service); claims + role extraction |
| `notifications.ts` | Email via Resend; returns `sent`/`failed` with reason |
| `contract-pdf.tsx` | Browser-only: `generateContractPdf(vars, tipo) → Blob`; 3 contract type React PDF components; `SigSpace` (ND-35–37) |
| `pdf-vars.ts` | `buildContractVars(employee, data) → ContractVars`; `firma` merged externally by callers |
| `contract-gen.js` | Kept (ND-12); no longer used for generation since Phase 11 |
| `security.js` | Browser-only: SHA-256 compute/verify via `window.crypto.subtle` |
| `excel-importer.ts` | Parse `.xlsx` (pure, no DOM); validate; return `ExcelImportResult` |
| `verify-integrity.ts` | Server Action: re-download PDF, re-compute SHA-256, compare to stored hash |
| `expiry-calculator.ts` | Pure: `(expiry_date | null, today) → status` |
| `compliance-checker.ts` | Aggregate current document statuses for a VerificationPair |
| `report-builder.ts` | Execute Query A + B; assemble `GA_F_094_Report` |
| `api/cron/route.ts` | Daily batch: recalculate statuses, detect transitions, fire notifications, write system_logs |
| `(app)/AppNav.tsx` | Navigation shell; 'use client'; active link via usePathname; sign out; "Admin" link for admins only; sticky top-0 z-40; hamburger menu (md:hidden) with dropdown on mobile — all nav links + right actions are `hidden md:flex` on desktop (ND-40) |
| `admin/layout.tsx` | Hard-redirects non-admins to `/dashboard`; admin-only gate for the entire `admin/` segment |
| `admin/actions/users.ts` | All user management Server Actions; all gated with `requireRole('admin')`; invite via Auth Admin API with rollback (ND-33); self-guard on role change + deactivation (ND-34); `deleteUserAction` hard-deletes auth + DB rows (ND-42) |
| `admin/users/[id]/UserDetail.tsx` | Inline role editor (dropdown + save/cancel); deactivate/reactivate with confirmation; hard-delete with two-click confirmation (ND-42); "Tú" badge; danger zone hidden for self |
| `auth/invite/page.tsx` | Client Component; on mount reads hash tokens (implicit flow) or code param (PKCE); establishes session; redirects to `/auth/set-password` (ND-43) |
| `auth/set-password/page.tsx` | Client Component; set initial password for invited user (min 8 chars); redirects to `/dashboard` |
| `*/layout.tsx` (segment wrappers) | Per-segment thin layouts injecting AppNav into dashboard/, contracts/, buses/, employees/ without moving page files |

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
NEXT_PUBLIC_APP_URL                    ← base URL for invite redirectTo (e.g. https://fnh-monolith.vercel.app); fallback hardcoded in inviteUserAction
```

> All 8 env vars are set in Vercel production. Supabase Dashboard → Authentication → URL Configuration must include `${NEXT_PUBLIC_APP_URL}/auth/invite` in Redirect URLs. `notifications.ts` parses `NOTIFICATION_RECIPIENT` as `split(',').map(s => s.trim()).filter(Boolean)` and sends to all addresses.

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
| v4.7 | Phase 9 complete — `employees/` module as full bounded context: list with search/filter/inactive toggle, create (explicit INSERT, ND-30), detail+edit, deactivate/reactivate, admin hard-delete with contracts guard; Excel import moved from `contracts/` to `employees/`; `Employee` type promoted to `(shared)/lib/employee-types.ts` (ND-28); `deactivated_at` soft-delete on `employees` table via migration 0008 (ND-29); `bulkUpsertEmployees` rewritten from N+1 to 2-query pattern; AppNav adds Empleados link + light/dark toggle; `globals.css` adds `font-size: 115%` for accessibility; flash-free theme via inline script + `suppressHydrationWarning` (ND-31); added ND-28 through ND-31 | Feature |
| v4.8 | Phase 10 complete — `admin/` user management module: three roles (admin/coordinator/viewer) with Spanish labels; invite via `auth.admin.inviteUserByEmail()` with rollback on DB failure (ND-33); `public.users` gains `email` + `deactivated_at` columns via migration 0009; deactivation calls `signOut(id)` immediately (ND-32); `getUserRole()` filters out deactivated users; self-protection guard in Server Actions + UI (ND-34); `admin/layout.tsx` redirects non-admins to `/dashboard`; AppNav shows "Admin" link only for admin role; ESLint boundaries updated with `admin` element type + cross-module rules; added ND-32 through ND-34 | Feature |
| v4.9 | Phase 11 complete — PDF-native generation: `@react-pdf/renderer` v4 replaces docxtemplater+.docx pipeline; `contract-pdf.tsx` encodes all three contract types + appendices (AutorizacionImagenes, DatosPersonales, Confidencialidad, Preaviso) as React PDF components; `pdf-vars.ts` builds `ContractVars`; `contract_templates` table dropped (migration 0010, ND-35); browser-only dynamic imports for renderer and signature_pad (ND-36); `firma?: string` in ContractVars + `SigSpace` placeholder/embed component (ND-37); `SignatureModal.tsx` full-screen canvas with devicePixelRatio-aware resize; signing flow: capture → generate signed PDF → browser download + Storage upload + DB update → `router.refresh()`; `ContractDetail` uses props directly so refresh propagates (ND-38); PDF section hidden on pending contracts (ND-39); PGRST116 silenced in `getContract`; `deleteContractAction` redirects after deletion; pako v1 override in package.json; added ND-35 through ND-39 | Feature |
| v5.0 | Phase 12 complete — Mobile/responsive layout (`mobile` branch): `p-6` → `px-4 py-6 sm:px-6` across all 19 pages/components; `AppNav.tsx` hamburger menu pattern (`md:hidden` toggle, `hidden md:flex` desktop links, dropdown with all nav + theme + sign out); all tables wrapped in `overflow-x-auto` with `hidden sm:table-cell` on non-essential columns (N°/Tipo/Inicio in contracts; Cédula/Cargo/Salario in employees; Cédula in drivers; Fecha in verification; all but Estado in employee contracts table); form grids `grid-cols-1 sm:grid-cols-2`; list headers `flex-col sm:flex-row sm:items-center`; detail info rows `flex-col sm:flex-row`; VehicleDetail summary `grid-cols-2 sm:grid-cols-4`; verification report header `grid-cols-1 sm:grid-cols-3`; document form date inputs full-width on mobile; added ND-40 | Mobile UI |
| v5.1 | Phase 12.x hotfixes — Three iOS Safari bugs patched after real-device testing: blob URL download navigating current page (contracts/new + signing flow); signature_pad canvas wiped by resize event on button tap (SignatureModal); window.open() blocked after await for Ver PDF (ContractDetail). Nav order changed to Panel → Empleados → Contratos → Buses. Added ND-41 | iOS hotfixes |
