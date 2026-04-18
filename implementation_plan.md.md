# FNH Monolith — Implementation Plan

## Current State Snapshot

> Actualizar al cerrar cada sesión. Para detalles, ver las secciones de fase correspondientes abajo.

- **Fase actual:** Phase 15 ✅ — mergeada a main (2026-04-18)
- **Último cambio importante:** Employee leaves + en_licencia vigency override + contract creation mode split + ciudad_cedula en PDF
- **Pendientes inmediatos:**
  - ⏳ Registrar contrato 2025 de Laura Angélica Ramírez + crear su licencia de maternidad en la plataforma
  - ⏳ Definir y arrancar Phase 16
- **Bugs abiertos conocidos:** ninguno
- **Siguiente milestone:** Phase 16 (por definir con el usuario)
- **⚠️ Infraestructura:** MCP Supabase apunta a `ukzccqogkbfdtymmgavj`; la app usa `qolnrtoznrgiedyhffbn`. Las migraciones SQL deben aplicarse manualmente en el Dashboard del proyecto correcto.

---

> **Last updated:** 2026-04-18
> **Status:** Phase 0 ✅ | Phase 1 ✅ | Phase 2 ✅ | Phase 3 ✅ | Phase 4 ✅ | Phase 5 ✅ | Phase 6 ✅ | Phase 7 ✅ | Phase 8 ✅ | Phase 9 ✅ | Phase 10 ✅ | Phase 11 ✅ | Phase 12 ✅ | Phase 12.x hotfixes ✅ | Phase 13 ✅ | Phase 14 ✅ | Phase 15 ✅

## Stack

- Next.js App Router (Next.js 15, TypeScript)
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (hosting + cron)
- Resend (email notifications)

## Module Structure

```
lib/                            ← root-level lib (Next.js middleware helper)
│   └── middleware.ts           ← updateSession(): refreshes Supabase session cookies,
│                                  reads auth state via getClaims() (local JWT, no round-trip),
│                                  redirects unauthenticated requests to /auth/login
│
app/
├── (shared)/
│   ├── lib/
│   │   ├── db.ts               ← rescued db.js, fully typed; includes logContractAction
│   │   ├── auth.ts             ← Supabase client factories + getUserClaims/getUserRole
│   │   └── notifications.ts    ← email dispatch (Resend)
│   └── components/             ← shared UI primitives
│
├── (app)/
│   ├── AppNav.tsx              ← 'use client'; nav: Panel/Contratos/Empleados/Buses + light/dark toggle + sign out; hamburger menu (md:hidden) for mobile (ND-40)
│   └── layout.tsx              ← renders AppNav + children; used by pages inside (app)/
│
├── auth/
│   └── login/
│       └── page.tsx            ← Supabase signInWithPassword form
│
├── contracts/
│   ├── actions/
│   │   ├── contracts.ts        ← 'use server': list, create, delete, attach PDF, import
│   │   └── verify-integrity.ts ← 'use server': SHA-256 re-verification via node:crypto
│   ├── components/
│   ├── lib/
│   │   ├── contract-pdf.tsx    ← BROWSER-ONLY; @react-pdf/renderer v4; 3 contract type components + SigSpace (ND-35, ND-36, ND-37)
│   │   ├── pdf-vars.ts         ← ContractVars interface + buildContractVars(); firma?: string (ND-37)
│   │   ├── contract-gen.js     ← kept but no longer used for generation; ND-12 (npm ES module)
│   │   └── security.js         ← browser-only; SHA-256 via window.crypto.subtle (ND-12)
│   ├── new/
│   │   └── page.tsx            ← contract creation: select employee + tipo + dates → generate PDF natively → download → createContractAction → navigate to detail
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; fetches contract + audit log + employee
│   │   ├── ContractDetail.tsx  ← 'use client'; props-direct (ND-38); signature modal, PDF view, integrity check, delete; PDF section gated (ND-39)
│   │   └── SignatureModal.tsx  ← 'use client'; full-screen canvas; signature_pad v5 dynamic import; devicePixelRatio-aware resize (ND-36)
│   ├── layout.tsx              ← thin wrapper importing AppNav
│   ├── page.tsx                ← contract list with estado badges
│   └── types.ts                ← re-exports Employee + JornadaLaboral from (shared); IntegrityResult; template_id: string | null
│
├── employees/
│   ├── actions/
│   │   └── employees.ts        ← 'use server': listEmployees, listAllEmployees, getById, create, update, deactivate, reactivate, delete, confirmImport
│   ├── lib/
│   │   └── excel-importer.ts   ← moved from contracts/lib; parses .xlsx; uses (shared) types (ND-4)
│   ├── new/
│   │   └── page.tsx            ← create form; explicit INSERT; cedula conflict = legible error (ND-30)
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; fetches employee + contracts + role in parallel
│   │   └── EmployeeDetail.tsx  ← 'use client'; edit form, contracts list, danger zone (deactivate/reactivate/delete)
│   ├── import/
│   │   └── page.tsx            ← 'use client'; three-phase Excel import (upload → diff → confirm)
│   ├── layout.tsx              ← thin wrapper importing AppNav
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
│   │   ├── fleet-compliance.ts ← 5-query batch aggregation for fleet-wide summary
│   │   └── report-builder.ts   ← executes Query A + Query B (DISTINCT ON replicated in JS, ND-14)
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
│   ├── layout.tsx              ← thin wrapper importing AppNav (Phase 3 nav fix)
│   ├── page.tsx                ← buses hub
│   └── types.ts                ← GA_F_094_Report type
│
├── dashboard/
│   ├── layout.tsx              ← thin wrapper importing AppNav (Phase 3 nav fix)
│   └── page.tsx                ← stats + role display
│
├── admin/
│   ├── actions/
│   │   └── users.ts            ← 'use server': listUsersAction, getUserAction, inviteUserAction, updateRoleAction, deactivateUserAction, reactivateUserAction, deleteUserAction (ND-42)
│   ├── users/
│   │   ├── new/
│   │   │   └── page.tsx        ← invite form: name, email, role selector + role description text
│   │   └── [id]/
│   │       ├── page.tsx        ← Server Component; fetches user + claims in parallel
│   │       └── UserDetail.tsx  ← 'use client'; inline role editor, deactivate/reactivate confirmation, hard-delete with two-click confirmation (ND-42), "Tú" badge, self-guard (ND-34)
│   ├── layout.tsx              ← redirects non-admin to /dashboard
│   ├── page.tsx                ← user list: 3 stats cards, active table, collapsed inactive section
│   └── types.ts                ← AppUserRole, AppUser, ROLE_LABELS, ROLE_COLORS
│
├── auth/
│   ├── callback/
│   │   └── route.ts            ← PKCE code exchange → session → redirect to `next` param (fallback: /dashboard)
│   ├── invite/
│   │   └── page.tsx            ← 'use client'; reads hash tokens (implicit flow) OR code param (PKCE) → setSession/exchangeCodeForSession → /auth/set-password (ND-43)
│   ├── set-password/
│   │   └── page.tsx            ← 'use client'; set password for newly invited user → /dashboard
│   └── login/
│       └── page.tsx            ← Supabase signInWithPassword form
│
└── api/
    └── cron/
        └── route.ts            ← Vercel Cron handler
```

## Component Responsibilities

| Component | Responsibility |
|---|---|
| `lib/middleware.ts` | Session cookie refresh + auth gate; delegates from root `middleware.ts` |
| `db.ts` | All Supabase query I/O; typed results; logContractAction (audit writes) |
| `auth.ts` | Supabase client factories (browser / server / service); claims + role helpers |
| `notifications.ts` | Email via Resend; returns `sent`/`failed` with reason |
| `contract-pdf.tsx` | Browser-only: `@react-pdf/renderer` v4; `generateContractPdf(vars, tipo) → Blob`; 3 contract components; `SigSpace` renders signature image or placeholder |
| `pdf-vars.ts` | `buildContractVars(employee, data) → ContractVars`; `firma?: string` added externally by callers |
| `contract-gen.js` | Kept (ND-12 applies) but no longer used for generation since Phase 11 |
| `security.js` | Browser-only: SHA-256 compute and verify via `window.crypto.subtle` |
| `SignatureModal.tsx` | Browser-only Client Component; full-screen canvas; `signature_pad` v5 dynamic import; `onConfirm(dataUrl)` callback |
| `excel-importer.ts` | Parse `.xlsx` (pure, no DOM); validate; return `ExcelImportResult` |
| `verify-integrity.ts` | Server Action: download PDF from Storage, re-compute SHA-256 via `node:crypto`, compare to `contracts.pdf_hash` |
| `expiry-calculator.ts` | Pure: `(expiry_date, hasExpiry, today) → status`; `hasExpiry=false` always returns `'Vigente'` (ND-22) |
| `compliance-checker.ts` | Aggregate current document statuses for an entity; recomputes from source truth via `computeStatus()` (ND-23) |
| `fleet-compliance.ts` | 5-query batch: active drivers, active vehicles, driver reqs, vehicle reqs, all events; in-memory aggregation; per-category reqMaps (ND-26) |
| `report-builder.ts` | Execute Query A + B; assemble `GA_F_094_Report` |
| `api/cron/route.ts` | Daily batch: recalculate, detect Crítico transitions, notify, log; retry pass for failed rows |
| `(app)/AppNav.tsx` | Navigation shell (Panel / Contratos / Empleados / Buses + light/dark toggle + sign out); 'use client'; active route via usePathname; `toggleTheme()` writes to localStorage + toggles `dark` class; hamburger menu (md:hidden) with full dropdown on mobile (ND-40) |
| `dashboard/layout.tsx`, `contracts/layout.tsx`, `buses/layout.tsx`, `employees/layout.tsx` | Thin per-segment wrappers that inject AppNav into pages outside the `(app)/` route group |
| `(shared)/lib/employee-types.ts` | Shared kernel: Employee, JornadaLaboral, ExcelEmployee, ExcelImportResult, ImportDiff — imported by both employees/ and contracts/ (ND-28) |
| `employees/actions/employees.ts` | All employee Server Actions; createEmployeeAction uses explicit INSERT (ND-30); deleteEmployeeAction is admin-only + zero-contracts guard (ND-29) |
| `employees/lib/excel-importer.ts` | Parse .xlsx (pure, no DOM); validate; return ExcelImportResult; moved from contracts/lib |
| `employees/page.tsx` | Employee list: search by name/cedula/cargo, jornada filter, active/inactive toggle, 4 stats cards |
| `employees/[id]/EmployeeDetail.tsx` | Edit form, contracts linked list, danger zone: deactivate (coordinator), reactivate, hard delete (admin + zero contracts) |
| `(shared)/lib/auth.ts` `requireRole()` | Throws if caller's role < minimum; called at top of every mutation Server Action |
| `(shared)/lib/auth.ts` `getUserRole()` | Returns user role from `public.users`; filters `deactivated_at IS NULL` so deactivated users get `null` (ND-32) |
| `admin/layout.tsx` | Hard-redirects non-admins to `/dashboard`; admin-only gate for entire `admin/` segment |
| `admin/actions/users.ts` | All user management Server Actions gated with `requireRole('admin')`; invite with rollback (ND-33); self-guard (ND-34); deactivate calls `signOut(id)` (ND-32) |
| `admin/types.ts` | `AppUserRole`, `AppUser`, `ROLE_LABELS` (Spanish), `ROLE_COLORS` (Tailwind classes) |
| `admin/page.tsx` | User list with 3 stats cards (activos/coordinadores/consultores); active users table; collapsed inactive section |
| `admin/users/new/page.tsx` | Invite form: name, email, role selector with per-role description text; calls `inviteUserAction` |
| `admin/users/[id]/UserDetail.tsx` | Inline role editor (dropdown + save/cancel); deactivate/reactivate with confirmation; "Tú" badge; danger zone hidden for self (ND-34) |
| `supabase/migrations/0004_rls.sql` | Row Level Security on all 13 tables; `get_my_role()` SECURITY DEFINER helper |
| `supabase/migrations/0005_storage_policies.sql` | `contracts` Storage bucket with subfolder-gated policies |
| `eslint.config.mjs` | ESLint flat config + `eslint-plugin-boundaries` enforcing ND-2 cross-module import rules |
| `playwright.config.ts` | Playwright config; auth setup project + chromium smoke project |
| `tests/auth.setup.ts` | Login once, save coordinator session to `tests/.auth/coordinator.json` |
| `tests/smoke.spec.ts` | 7 authenticated smoke tests (dashboard, contracts, buses, nav flow) |
| `tests/buses.spec.ts` | 11 E2E tests — driver/vehicle/verification form flows, import/templates pages, contracts list links |
| `tests/unauthenticated.spec.ts` | 7 redirect assertions (protected routes → /auth/login) |
| `contracts/import/page.tsx` | Three-phase Excel import: file upload → browser diff → `confirmExcelImportAction()` |
| `contracts/templates/page.tsx` | Template CRUD: list from DB, upload `.docx` to Storage `templates/`, delete with Storage cleanup |
| `supabase/scripts/seed_load_test.sql` | 200 test vehicles × vehicle requirements for cron load testing |
| `app/globals.css` | OKLCH color tokens; dark mode default; cyan `#38c8d8` as sole accent; near-black background `oklch(0.08)`; `font-size: 115%` on `html` for accessibility |
| `app/layout.tsx` | Geist (sans) + Geist Mono loaded; inline `<script>` reads localStorage before first paint (flash-free theme); `suppressHydrationWarning` on `<html>`; tab title "FNH" |
| `(app)/AppNav.tsx` | Redesigned: FNH logo in cyan, active route = cyan text only (no background), sticky + backdrop blur; light/dark toggle button |

## Expiry Status Thresholds

| Status | Condition |
|---|---|
| Vigente | > 90 days remaining |
| Seguimiento | 61–90 days remaining |
| Alerta | 22–60 days remaining |
| Crítico | ≤ 21 days OR no expiry date on record |

## Phases

### Phase 0 — Foundation ✅
- Scaffold Next.js App Router project (TypeScript, Tailwind 4, shadcn/ui)
- Configure Supabase SSR auth helpers (PUBLISHABLE_KEY / SECRET_KEY — JWT disabled)
- Implement `middleware.ts` + `lib/middleware.ts` (getClaims(), auth protection all routes)
- Applied migration `0001_initial.sql` (all base tables + corrected IMMUTABLE indexes)
- Applied migration `0002_extend_contracts.sql` (employees extended, contracts extended, contract_audit_logs, config)
- Configured Vercel project and environment variables

### Phase 1 — Contracts Module ✅
- Ported db.js → `(shared)/lib/db.ts` (fully typed; audit writes merged in via logContractAction)
- Converted `contract-gen.js` and `security.js` to npm ES module imports (ND-12)
- Built `excel-importer.ts` (two-phase, ND-4)
- Built `verify-integrity.ts` Server Action (node:crypto)
- Implemented `app/contracts/actions/contracts.ts` (all Server Actions)
- Built `/dashboard` page (stats + role display)
- Built `/contracts` list page (table with estado badges)
- Built `/contracts/new` — employee/template selection, docxtemplater generation, Storage upload, createContractAction
- Built `/contracts/[id]` — contract detail (Server Component) + `ContractDetail.tsx` (PDF upload, integrity check, audit log, delete)

### Phase 2 — Buses Module ✅
- Vehicle and driver CRUD (create, list, deactivate, detail pages)
- Verification pair CRUD
- `supabase/migrations/0003_seed_document_requirements.sql` — 16 driver + 7 vehicle requirements (idempotent)
- `expiry-calculator.ts` — 4 thresholds: Vigente >90d, Seguimiento 61–90d, Alerta 22–60d, Crítico ≤21d or null
- Document record entry (`driver_document_events`, `vehicle_document_events`) via `recordDriverDocumentsAction` / `recordVehicleDocumentsAction`
- `compliance-checker.ts` — DISTINCT ON replicated in JS (ND-14); current status per entity
- `report-builder.ts` — Query A + Query B in parallel; all 4 canonical WHERE conditions; GA_F_094_Report assembly
- `StatusBadge.tsx` — color-coded status badge component
- `buses.ts` Server Actions — full CRUD + compliance + report generation
- All buses pages: hub, drivers list/new/[id], vehicles list/new/[id], verification list/new/[id]
- Nav shell fix: `(app)/AppNav.tsx` + per-segment layout.tsx wrappers for dashboard, contracts, buses

### Phase 3 — Cron and Notifications ✅
- `app/api/cron/route.ts` — corrected ND-1 two-branch notification condition
- Retry pass for `failed`/`retrying` rows (max 3 attempts) via next cron run
- `system_logs` structured output per run (crash-safe: writes even on unhandled error)
- `app/(shared)/lib/notifications.ts` — Resend email dispatch with HTML template
- `vercel.json` with cron schedule `0 11 * * *` UTC (06:00 Colombia)
- Nav shell (`app/(app)/AppNav.tsx`) + segment layouts for dashboard, contracts, buses

### Phase 4 — Hardening ✅
- `supabase/migrations/0004_rls.sql` — RLS enabled on all 13 tables; `get_my_role()` SECURITY DEFINER helper breaks the circular dependency on `users`
- `supabase/migrations/0005_storage_policies.sql` — `contracts` bucket created; read: all authenticated; templates write: admin; docx/pdf write: coordinator+admin; delete: admin
- `requireRole()` added to `(shared)/lib/auth.ts`; all mutation Server Actions (contracts + buses) guard-checked at entry
- `eslint.config.mjs` created; `eslint-plugin-boundaries` enforces ND-2 (contracts/buses may not import each other)
- Playwright installed: `playwright.config.ts`, `tests/auth.setup.ts` (login once, save state), `tests/smoke.spec.ts` (7 authenticated flows), `tests/unauthenticated.spec.ts` (7 redirect assertions)
- `supabase/scripts/seed_load_test.sql` — 200 test vehicles × all vehicle requirements; spread across all 4 expiry buckets; cleanup query included

### Phase 5 — UI/UX Redesign ✅
- **Color system** (`globals.css`): OKLCH tokens; single accent color cyan `#38c8d8` (`oklch(0.76 0.105 198)`); near-black dark background `oklch(0.08)`; borders at 8% white opacity; no gradients
- **Dark mode default**: `dark` class on `<html>` in root layout; light mode available but dark is the app default
- **Typography**: `Geist` (sans-serif) for all body/UI text; `Geist_Mono` for contract numbers, cédulas, placas, fechas, hashes, error codes, status tags — `font-mono` applied per-element
- **Navigation** (`AppNav.tsx`): sticky + `backdrop-blur-sm`; logo "FNH" in cyan with `tracking-widest uppercase`; active link = `text-primary` only (no background highlight); height reduced to `h-12`
- **Page layout**: all pages use `max-w-5xl mx-auto` (lists) or `max-w-3xl mx-auto` (detail/forms); `px-4 py-6 sm:px-6` outer padding (Phase 12 mobile update from `p-6`)
- **Labels**: all form and section labels use `text-xs font-medium uppercase tracking-wide text-muted-foreground`
- **Buttons**: primary = `bg-primary text-primary-foreground font-semibold`; secondary = `border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30`
- **Tables**: header row `text-xs uppercase tracking-wide text-muted-foreground bg-muted/40`; row hover `bg-muted/20`; "Ver →" links transition to `text-primary`
- **StatusBadge**: semitransparent backgrounds (15% opacity) + matching border (20% opacity) — no solid color blocks
- **Status chips** (Firmado / Pendiente): `font-mono text-xs` with colored text + matching border/bg at low opacity; rounded-full pill shape
- **Detail Row component** (`ContractDetail`): label column `w-44 text-xs uppercase tracking-wide`; value optionally `font-mono`
- **PDF integrity result**: colored border+bg block with `font-mono text-[11px]` hash display

### Phase 7 — Deployment and Build Hardening ✅
- **GitHub repo**: [github.com/Palaitox/FNH-Monolith](https://github.com/Palaitox/FNH-Monolith) — branch `main`; CI autodeploy on push enabled via Vercel ↔ GitHub integration
- **Production URL**: [fnh-monolith.vercel.app](https://fnh-monolith.vercel.app)
- **`.gitignore` additions**: `.claude/` (Claude Code local config) and `.playwright-mcp/` (MCP test artifacts) excluded from version control
- **Vercel project**: `fnh-monolith` under `rdpalau-2419s-projects` scope; linked with `vercel link --project fnh-monolith`
- **7 production env vars** set via Vercel CLI: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `RESEND_FROM_EMAIL`, `NOTIFICATION_RECIPIENT`
- **Build warning fixes**: removed genuinely unused `btnPrimary` and `fieldClass` from `ContractDetail.tsx`; removed unused `ext` variable from `templates/page.tsx`
- **Build review finding (HIGH)**: `eslint-disable-next-line` comment incorrectly suppressed a valid `res` usage in `import/page.tsx` — caused by indentation error during the quick fix. Corrected by removing the comment and fixing indentation; `res` is correctly consumed by `setResult(res)` on the next line
- **ESLint config**: added `@typescript-eslint/no-unused-vars: ['warn', { ignoreRestSiblings: true }]` to `eslint.config.mjs` to correctly handle the `({ source, ...e }) => e` destructure-to-omit pattern (ND-21)
- **Clean build**: zero errors, zero warnings on final deploy

### Phase 6 — Features and UX Polish ✅
- **Email env vars**: `RESEND_FROM_EMAIL` and `NOTIFICATION_RECIPIENT` added to `.env.local`; notification system fully configured
- **Excel import UI** (`app/contracts/import/page.tsx`): three-phase client flow — file upload → browser-side parse + diff (no DB write) → user confirms → `confirmExcelImportAction()`. Shows stat cards (new/updated/unchanged), per-field diff table for updated rows, warnings list. Accessible from contracts list header
- **Template management UI** (`app/contracts/templates/page.tsx`): list all templates, upload `.docx` to `contracts/templates/` in Supabase Storage then register in DB, delete with confirmation modal (also removes Storage file). New db.ts functions: `createContractTemplate()`, `deleteContractTemplate()`. New Server Actions: `uploadTemplateAction()`, `deleteTemplateAction(storagePath)` — delete is Storage-first then DB
- **Lint script migration**: `"lint": "next lint"` → `"lint": "eslint ."` in `package.json`. ESLint 9 flat config (`eslint.config.mjs`) was already compatible; no config changes needed
- **E2E tests for buses + new pages** (`tests/buses.spec.ts`): 11 tests — driver form renders/validates/submits, vehicle form renders/validates/submits, verification form renders/validates, import page renders, templates page renders, contracts list shows import+templates links
- **UX navigation fixes**: all list pages (`buses/drivers`, `buses/vehicles`, `buses/verification`) now have `← Buses` breadcrumb link above heading
- **Phase 5 style consistency pass**: list pages (`buses/drivers`, `buses/vehicles`, `buses/verification`, `buses/page`, `contracts/page`) unified to Phase 5 standards — `max-w-5xl mx-auto`, `border-border bg-card` tables, `text-xs uppercase tracking-wide bg-muted/40` headers, `hover:bg-muted/20` rows, pill status chips with semitransparent color, "Ver →" `hover:text-primary`

### Phase 8 — Dashboard, Fleet Compliance, SERVITRANS Requirements, Notification Hardening ✅

#### Dashboard rebuild
- `app/dashboard/page.tsx` rebuilt with two sections: Contracts stats (total / signed / pending) + Fleet compliance
- Fleet section shows 4 status-count cards colored per status (Vigente/Seguimiento/Alerta/Crítico)
- `needsAttention` list: each entry shows entity name + `urgentDocs` (worst requirement name) + `missingCount` explanation ("X docs sin registrar")
- Edge cases: all-green message when fleet is compliant; empty-fleet message when no active entities

#### Fleet compliance engine (`fleet-compliance.ts`)
- `getFleetCompliance(supabase)` — 5 parallel queries: active drivers, active vehicles, driver requirements, vehicle requirements, all events
- Per-category reqMaps (`driverReqMap` / `vehicleReqMap`) — critical for correct `missingCount` per entity type (ND-26)
- `missingCount = reqMap.size − seen.size` (requirements with at least one event row)
- `overall = missingCount > 0 ? 'Crítico' : worstStatus(allStatuses)` (ND-26)
- Recomputes status from source truth via `computeStatus(ev.expiry_date, req.has_expiry)` (ND-23)
- Exported as `getFleetComplianceAction()` in `buses.ts`

#### `computeStatus` signature fix (ND-22)
- Added `hasExpiry: boolean` second parameter to `expiry-calculator.ts`
- `has_expiry=false` → returns `'Vigente'` immediately; null `expiry_date` for expiry docs still returns `'Crítico'`
- `has_expiry` threaded through: compliance-checker, fleet-compliance, both record actions, cron handler

#### Compliance recompute from source truth (ND-23)
- `compliance-checker.ts` no longer reads `ev.computed_status` — recomputes via `computeStatus(ev.expiry_date, req.has_expiry)` live
- `fleet-compliance.ts` follows the same pattern
- Fixes: stale stored status from before ND-22 was introduced now auto-corrects on next compliance fetch

#### SERVITRANS driver requirements (migration 0007)
- `supabase/migrations/0007_servitrans_driver_requirements.sql` — hard replace all driver requirements
- 15 binary checklist items (`has_expiry=false`): Paz y salvo EPS, Afiliación ARL, Carta de presentación SERVITRANS, Formato hoja de vida, Fotocopia cédula, Fotocopia libreta militar, Antecedentes judiciales, Antecedentes disciplinarios, Antecedentes fiscales, Récord de accidentalidad, Aptitud psicofísica, Certificado retiro fuerzas militares, Certificado afiliación fondo pensiones, Certificado SIMIT, Curso 8 horas SENA
- 1 dated document (`has_expiry=true`): Licencia de conducción C2 (valid ≤ 30 days before expiry, Crítico at 0)
- `DriverDetail.tsx` rewritten: progress ring SVG, separate `checked`/`expiryInputs` state, pre-checked + disabled already-recorded items, only newly-checked items submitted (ND-25)

#### Vehicle requirements cleanup (migration 0006)
- `supabase/migrations/0006_update_vehicle_requirements.sql` — hard DELETE events + requirements for RCEC and Tarjeta de propiedad
- Renamed RCC → "Seguro obligatorio (SOAT)", Licencia de tránsito → kept; added "Certificado de revisión preventiva"
- `VehicleDetail.tsx`: added `DaysChip` component, expiry date + days-remaining display, `has_expiry` threaded into form submission

#### Hard delete with cascade (ND-27)
- `deleteDriverAction(id)`: deletes `driver_document_events` → `verification_pairs` → `drivers` in sequence
- `getDriverById` / `getVehicleById` changed from `.single()` to `.maybeSingle()` to survive post-delete navigation
- Two-click confirmation in `DriverDetail.tsx` UI before calling action

#### Notification hardening (ND-24)
- Removed `checkShouldNotify()` function from `cron/route.ts`; replaced with `transitionedToCritico = newStatus === 'Crítico' && previousStatus !== 'Crítico'`
- Added immediate notification in `recordDriverDocumentsAction` / `recordVehicleDocumentsAction` for born-Crítico docs (manual record path)
- Cron now handles day-over-day transitions only; no Alerta emails from either path
- `NOTIFICATION_RECIPIENT` expanded to 5 comma-separated addresses
- `RESEND_FROM_EMAIL` changed to `"FNH <onboarding@resend.dev>"` (Resend free-tier verified sender)
- `middleware.ts` matcher updated to exclude `api/` routes (cron was receiving redirect to `/auth/login`)
- Confirmed working on Vercel URL (localhost uses `.env.local` which doesn't have real Resend credentials in dev)

### Phase 9 — Employees Module ✅

#### Shared kernel
- `app/(shared)/lib/employee-types.ts` (CREATED) — Employee, JornadaLaboral, ExcelEmployee, ExcelImportResult, ImportDiff types promoted out of `contracts/types.ts` (ND-28)
- `app/contracts/types.ts` now re-exports Employee + JornadaLaboral from shared (backwards compat)

#### Migration 0008
- `supabase/migrations/0008_employees_softdelete.sql` — ADD COLUMN `deactivated_at timestamptz` on `employees`; partial index `idx_employees_active` (ND-29)

#### Module files
- `app/employees/actions/employees.ts` — full CRUD Server Actions: listEmployees (active only), listAllEmployees, getById, create (explicit INSERT, ND-30), update, deactivate, reactivate, delete (admin + zero-contracts guard)
- `app/employees/lib/excel-importer.ts` — moved from `contracts/lib/excel-importer.ts`; imports from (shared)
- `app/employees/page.tsx` — list with name/cedula/cargo search, jornada filter, active/inactive toggle, 4 stats cards
- `app/employees/new/page.tsx` — create form; surfaces cedula duplicate as human-readable error
- `app/employees/[id]/page.tsx` + `EmployeeDetail.tsx` — Server Component fetches employee + contracts + role in parallel; Client Component handles edit, contracts list, danger zone
- `app/employees/import/page.tsx` — three-phase import moved from `contracts/import/`
- `app/employees/layout.tsx` + `app/employees/types.ts` — standard module wrappers

#### ESLint boundaries (ND-2)
- `eslint.config.mjs` updated: `employees` added as element type; cross-module rules: employees↔contracts and employees↔buses disallow

#### Theme + accessibility
- `app/layout.tsx` — removed hardcoded `dark` class; added inline script for flash-free theme; `suppressHydrationWarning` on `<html>` (ND-31)
- `app/(app)/AppNav.tsx` — added `isDark` state + `useEffect`; `toggleTheme()` writes localStorage + toggles class; `☀/☾` button; added Empleados nav link
- `app/globals.css` — added `font-size: 115%` on `html` for accessibility

#### db.ts changes
- `getEmployees` now filters `.is('deactivated_at', null)` — active only
- `getAllEmployees` added — no filter (for employees module toggle)
- `bulkUpsertEmployees` rewritten from N+1 loop to 2-query pattern (1 SELECT IN + 1 bulk UPSERT)

### Phase 10 — Admin User Management Module ✅

#### Migration 0009
- `supabase/migrations/0009_users_softdelete.sql` — ADD COLUMN `email text` and `deactivated_at timestamptz` on `public.users`; partial index `idx_users_active`; `users_delete_admin` DELETE policy (ND-32)

#### Types
- `app/admin/types.ts` (CREATED) — `AppUserRole` ('admin' | 'coordinator' | 'viewer'), `AppUser`, `ROLE_LABELS` (Spanish: Administrador/Coordinador/Consultor), `ROLE_COLORS` (per-role Tailwind color classes)

#### Server Actions (`app/admin/actions/users.ts`)
- All actions gated with `requireRole('admin')`
- `listUsersAction` — lists all users ordered by active-first, then name
- `getUserAction(id)` — single user by id
- `inviteUserAction(name, email, role)` — calls `supabase.auth.admin.inviteUserByEmail()` (service client), then inserts `public.users`; rolls back with `deleteUser()` if DB insert fails (ND-33)
- `updateRoleAction(id, role)` — updates role; guards `claims.sub === id` (ND-34)
- `deactivateUserAction(id)` — sets `deactivated_at`; calls `supabase.auth.admin.signOut(id)` to immediately invalidate all sessions (ND-32); guards self-deactivation (ND-34)
- `reactivateUserAction(id)` — clears `deactivated_at`
- `deleteUserAction(id)` — deletes `public.users` row first, then `auth.users` via Admin API; guards self-deletion (ND-42)

#### Pages and components
- `app/admin/layout.tsx` — `getUserRole()` at layout level; redirects non-admin to `/dashboard`
- `app/admin/page.tsx` — user list with 3 stats cards (activos/coordinadores/consultores); active users in table; inactive users in collapsed section
- `app/admin/users/new/page.tsx` — invite form with name, email, role selector; per-role description text; calls `inviteUserAction`
- `app/admin/users/[id]/page.tsx` — Server Component; `getUserAction(id)` + `getUserClaims()` in parallel; passes `currentUserId` to `UserDetail`
- `app/admin/users/[id]/UserDetail.tsx` — Client Component; inline role editor (dropdown + save/cancel); deactivate/reactivate with confirmation step; hard-delete with two-click confirmation (ND-42); "Tú" badge when `isSelf`; danger zone entirely hidden for self (ND-34)

#### ESLint boundaries update
- `eslint.config.mjs` — `{ type: 'admin', pattern: 'app/admin/**/*' }` element added; rule: `admin/` disallows importing from `contracts`, `buses`, `employees`

#### auth.ts changes
- `getUserRole()` now filters `.is('deactivated_at', null)` — deactivated users return `null` role (ND-32)
- `.single()` changed to `.maybeSingle()` to avoid error when no row matches

#### AppNav changes
- `ADMIN_LINK = { href: '/admin', label: 'Admin' }` added
- Nav array uses `[...NAV_LINKS, ...(role === 'admin' ? [ADMIN_LINK] : [])]` — "Admin" visible only to admins

### Phase 11 — PDF-Native Generation and Digital Signature ✅

#### Migration 0010
- `supabase/migrations/0010_drop_contract_templates.sql` — DROP FK `contracts_template_id_fkey`; ALTER `contracts.template_id` nullable; DROP TABLE `contract_templates` (ND-35)

#### New files
- `app/contracts/lib/contract-pdf.tsx` (CREATED) — `@react-pdf/renderer` v4; three contract types as React PDF components; shared appendices (AutorizacionImagenes, DatosPersonales, Confidencialidad, Preaviso); `SigSpace` renders signature image or 60px placeholder box (ND-37)
- `app/contracts/lib/pdf-vars.ts` (CREATED) — `ContractVars` interface with `firma?: string`; `buildContractVars(employee, data)` — `firma` is never set here, merged externally by callers (ND-37)
- `app/contracts/[id]/SignatureModal.tsx` (CREATED) — full-screen canvas modal; `signature_pad` v5 dynamically imported; `devicePixelRatio`-aware `resizeCanvas`; `touch-none` prevents scroll while drawing; `onConfirm(dataUrl)` + `onClose` props (ND-36)

#### Removed
- `app/contracts/templates/page.tsx` — template management UI deleted (ND-35)
- `getContractTemplates`, `createContractTemplate`, `deleteContractTemplate` removed from `db.ts` (ND-35)
- `listTemplates`, `uploadTemplateAction`, `deleteTemplateAction` removed from `contracts/actions/contracts.ts` (ND-35)
- `ContractGenEmployee`, `mapEmployeeForContractGen` removed from `contracts/types.ts` (ND-35)

#### Modified: `app/contracts/new/page.tsx`
- No more template selector; no template_id in form
- On submit: dynamically imports `generateContractPdf` + `buildContractVars` → builds `ContractVars` → generates PDF blob → triggers browser download → `createContractAction` (no template_id) → `router.push` to detail page

#### Modified: `app/contracts/[id]/page.tsx`
- Now also fetches the full `Employee` record alongside contract + audit logs; passes `employee` to `ContractDetail`

#### Modified: `app/contracts/[id]/ContractDetail.tsx`
- Added `employee: Employee | null` prop
- Signature flow: open `SignatureModal` → `onConfirm(dataUrl)` → dynamic import PDF modules + `getAppSettings()` in parallel → build vars with `firma` → generate signed PDF → browser download → Storage upload (upsert) → `attachSignedPdfAction` → `router.refresh()`
- Props used directly — no `useState` wrappers for `contract` or `auditLogs` (ND-38)
- "PDF firmado" section gated: `(isSignedState || !!contract.pdf_path)` (ND-39)
- Integrity result: human-readable messages only, no raw hash strings in UI
- `handleOpenPdf`: creates Supabase signed URL (1 hour) and opens in new tab

#### Modified: `app/(shared)/lib/db.ts`
- `getContract` silences PGRST116 (no-rows error code) — valid after deletion, not logged as error
- `createContract` no longer requires `template_id`
- `attachSignedPdf` sets `estado: 'signed'` + `signed_at: now()` atomically on the same row

#### Modified: `app/contracts/actions/contracts.ts`
- `deleteContractAction` now calls `redirect('/contracts')` after deletion — prevents the detail page from re-rendering for a deleted contract (PGRST116)
- `createContractAction` no longer accepts or passes `template_id`
- `attachSignedPdfAction` added to module (was already present, now used by the signing flow)

#### package.json additions
- `"signature_pad": "^5.1.3"` — stylus/touch/mouse signature capture
- `"overrides": { "pako": "1" }` — pins pako to v1 for `@react-pdf/pdfkit` internal path compatibility (ND-35)

#### Known minor gaps (not bugs)
- `handleOpenPdf` catches errors with `console.error` only — no user-visible message if signed URL creation fails
- `integrityResult` client state is not cleared on `router.refresh()` — stale only if user ran a check before signing; next check overwrites it

### Phase 12 — Mobile Responsive Layout ✅

**Branch:** `mobile`

#### AppNav.tsx
- Added `menuOpen` state + `useEffect` to close on pathname change
- Desktop nav: `hidden md:flex` on all nav links + right-side actions
- Mobile hamburger: `md:hidden` button with `<Menu>` / `<X>` from lucide-react
- Mobile dropdown: renders below header when `menuOpen`; contains all nav links + theme toggle + sign out
- Header: `sticky top-0 z-40`

#### Global padding pattern (ND-40)
- All page outer containers changed from `p-6` to `px-4 py-6 sm:px-6`
- `auth/login/page.tsx`: added `px-4` to outer div

#### Tables (all list pages)
- Tables wrapped in `overflow-x-auto` container
- Non-essential columns tagged `hidden sm:table-cell` on both `<th>` and `<td>`:
  - `contracts/page.tsx`: hides N° Contrato, Tipo, Fecha inicio
  - `employees/page.tsx`: hides Cédula, Cargo, Salario base
  - `buses/drivers/page.tsx`: hides Cédula
  - `buses/verification/page.tsx`: hides Fecha verificación

#### Form grids
- `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` in:
  - `employees/new/page.tsx` (Teléfono/Correo + Salario/Auxilio grids)
  - `employees/[id]/EmployeeDetail.tsx` (same grids in edit form)
  - `contracts/new/page.tsx` (date fields grid)

#### Header rows (list + detail pages)
- `flex items-center justify-between` → `flex flex-col sm:flex-row sm:items-center justify-between gap-3` on all module list pages (contracts, employees, buses/drivers, buses/vehicles, buses/verification)

#### Detail pages
- `ContractDetail.tsx` Row sub-component: `flex-col sm:flex-row sm:items-center` + `sm:w-44 sm:shrink-0` on label
- `EmployeeDetail.tsx` read-only info rows: `flex-col sm:flex-row sm:items-center` + `sm:w-44 sm:shrink-0`
- `EmployeeDetail.tsx` contracts table: `overflow-x-auto`; all columns hidden except Estado + action on mobile
- `VehicleDetail.tsx` summary grid: `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`
- `buses/verification/[id]/page.tsx` report header: `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- `DriverDetail.tsx` + `VehicleDetail.tsx` document form expiry inputs: `w-36` → `w-full sm:w-36`; row layout `flex-col sm:flex-row sm:items-center`

### Phase 12.x — iOS Hotfixes ✅

Three iOS Safari bugs found during real-device testing. All fixes are mobile-only; zero desktop behavior change. See ND-41.

#### contracts/new/page.tsx
- `createContractAction` moved **before** the download attempt
- Download skipped entirely on mobile (`/Mobi|Android|iPhone|iPad|iPod/i` UA check)
- Desktop: unchanged (download still triggers after save)

#### contracts/[id]/SignatureModal.tsx
- `resizeCanvas()` now calls `pad.toData()` before clearing and `pad.fromData()` after
- Prevents iOS browser-toolbar `window.resize` events from wiping the signature mid-session
- First "Confirmar firma" tap now works reliably

#### contracts/[id]/ContractDetail.tsx
- `attachSignedPdfAction` (marks contract signed) moved **before** the download attempt
- Download skipped on mobile — same UA check as above
- `handleOpenPdf`: `window.open('', '_blank')` called synchronously within the click handler; `newWindow.location.href` set after the signed URL resolves; blank tab closed on error
- Nav link order changed: Panel → Empleados → Contratos → Buses

### Phase 13 — User Management Improvements 🔄

#### Hard delete for users (ND-42) ✅
- `deleteUserAction(id)` added to `app/admin/actions/users.ts` — deletes `public.users` row (FK order), then `auth.users` via `supabase.auth.admin.deleteUser()` (service client); guards self-deletion; `revalidatePath('/admin')`
- `UserDetail.tsx` — added `confirmDelete` state; delete section in danger zone (always visible for other users regardless of active/inactive); bolder border styling vs deactivate button; on success navigates to `/admin`

#### Invite flow fix — PKCE + implicit token handling (ND-43) ✅
- **Root cause**: `inviteUserByEmail` sends email with hash tokens (implicit flow). The original `/auth/callback` route handler runs server-side and never receives the URL hash — `code` was always null → fell back to `/auth/login?error=invalid_invite`.
- `app/auth/invite/page.tsx` (CREATED) — Client Component; on mount reads `window.location.hash` for `access_token` + `refresh_token` (implicit flow path) and calls `supabase.auth.setSession()`; also handles PKCE `code` query param via `exchangeCodeForSession()` as fallback; always redirects to `/auth/set-password` on success.
- `inviteUserAction` `redirectTo` updated from `/auth/callback?next=/auth/set-password` to `/auth/invite` (simpler, avoids query-param loss).
- Supabase Dashboard → URL Configuration: `http://localhost:3000/auth/invite` and `https://fnh-monolith.vercel.app/auth/invite` added to allowed Redirect URLs.
- `app/auth/set-password/page.tsx` (CREATED) — Client Component; validates min 8 chars + match; calls `supabase.auth.updateUser({ password })`; redirects to `/dashboard`.
- `app/auth/callback/route.ts` retained for other PKCE flows (password reset, OAuth).

#### updateRoleAction service client fix ✅
- `updateRoleAction` switched from `createClient()` (publishable key) to `createSupabaseServiceClient()` — consistent with all other admin mutations; eliminates potential RLS race condition.

#### Role display sync fix ✅
- `UserDetail.tsx` — added `useEffect(() => { setSelectedRole(user.role) }, [user.role])` to sync local state when server refreshes props.
- `handleRoleSave` uses `router.push(\`/admin/users/\${user.id}\`)` instead of `router.refresh()` to force full remount with fresh server data.

#### Pending issues (next session)
- Error on cancel in `/admin/users/new`: exact error message not yet confirmed — likely a Server Component crash with no `error.tsx` boundary. Fix: add `app/admin/error.tsx` and investigate root cause.
- Role bug when changing active user role: exact reproduction steps + error to be confirmed next session.

### Phase 14 — Contracts Polish + Historical Data Load ✅

- Expediente model fully adopted in production; 32+ historical contracts imported via PDF import flow
- Gap-fill numeración: `claim_next_case_number()` table-scan + advisory lock (ND-46, migrations 0012–0014)
- Vigency fallback chain: `current_end_date ?? fecha_terminacion(INICIAL)` (ND-47)
- `ContractsList.tsx`: case tree view, vigency badges, search + filter, `+ Agregar` button
- Dashboard "Estado contractual de empleados": sinContrato / pendienteFirma / vigentes summary
- `getEmployeeContractStatusAction()` added to `contracts/actions/contracts.ts`

### Phase 15 — Employee Leaves, ciudad_cedula, Contract Flow Split ✅

#### Migration 0015 — ciudad_cedula
- ADD COLUMN `ciudad_cedula text` on `employees`
- Surfaced in `NewEmployeeForm`, `EmployeeDetail` (edit + read-only), Excel import, PDF ("expedida en [city]")
- `buildContractVars()` populates `trabajador_ciudad_cedula: employee.ciudad_cedula ?? ''`; PDF renders conditionally in `LaboralIntro` and `ContratoPrestacionServicios`

#### Forma de pago update
- `SETTINGS_DEFAULTS.formaPago` in `db.ts` and hardcoded value in `contract-pdf.tsx` updated to "MENSUAL ENTRE EL DÍA QUINCE (15) Y EL DÍA VEINTE (20) DE CADA MES"

#### Contract creation mode split (ND-48)
- `NewContractForm.tsx`: `TIPO_INICIAL_OPTIONS` (TC, MT, PS) vs `TIPO_ADICIONAL_OPTIONS` (Otro Sí)
- `modoAdicional = !!preCaseId`; title changes to "Agregar al expediente" when true
- `+ Agregar` button in `CaseCard` guarded: `group.docs.some(d => d.document_type === 'INICIAL')`
- Button label on `/contracts` page: "+ Nuevo contrato inicial"
- `indefinido` removed as contract tipo option

#### Employee stats grid fix
- `EmployeesList.tsx`: `sm:grid-cols-4` → `sm:grid-cols-5` (5 stat cards render in one row)

#### Migration 0016 — employee_leaves (ND-49)
- CREATE TABLE `employee_leaves`: id, employee_id (FK→employees ON DELETE CASCADE), leave_type (CHECK: maternidad/paternidad/incapacidad/luto/otro), start_date, expected_end_date, actual_end_date, notes, created_at
- RLS: SELECT open to authenticated; INSERT/UPDATE/DELETE restricted to admin + coordinator via `get_my_role()`
- New shared types: `LeaveType`, `EmployeeLeave`, `LEAVE_TYPE_LABELS` in `employee-types.ts`
- New module: `app/employees/actions/leaves.ts` — `getEmployeeLeavesAction`, `createLeaveAction`, `closeLeaveAction`
- `EmployeeDetail.tsx`: leave management section — active leave banner + close button, create form, history list
- `app/employees/[id]/page.tsx`: fetches `leaves` in parallel via `getEmployeeLeavesAction`

#### en_licencia vigency override (ND-49)
- `getActiveLeavesMap(supabase)` in `db.ts` — returns `Map<employee_id, EmployeeLeave>` for all active leaves
- `groupByCases()` in `contracts/page.tsx`: `vencido` → `en_licencia` when employee is in map
- `getEmployeeContractStatusAction()` in `contracts/actions/contracts.ts`: employees on leave with expired contracts → `enLicencia` bucket (not `sinContrato`)
- `VigencyStatus` union extended with `'en_licencia'`; `VIGENCY_BORDER` + `VigencyBadge` updated (violet)
- Dashboard: 4th summary card "En licencia" (violet) + employee list section

## Rescued Assets from Existing Codebase

| File | Destination | Notes |
|---|---|---|
| `db.js` | `(shared)/lib/db.ts` | Fully rewritten in TypeScript; method signatures preserved; audit writes (logContractAction) merged in |
| `contract-gen.js` | `contracts/lib/contract-gen.js` | Function bodies unchanged; CDN globals replaced with npm ES module imports (ND-12) |
| `security.js` | `contracts/lib/security.js` | Function bodies unchanged; IIFE wrapper replaced with named ES module exports (ND-12) |

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY   ← sb_publishable_... (JWT disabled)
SUPABASE_SECRET_KEY                    ← sb_secret_... (replaces service role key)
CRON_SECRET                            ← 64-char hex; verified in cron Authorization header
RESEND_API_KEY
RESEND_FROM_EMAIL                      ← sender; use "FNH <onboarding@resend.dev>" on Resend free tier (unverified domains rejected)
NOTIFICATION_RECIPIENT                 ← comma-separated list of recipients for all Crítico-transition alerts
```

> **Note on key naming**: Supabase projects with JWT disabled use `PUBLISHABLE_KEY` (browser-safe, no JWT signing) and `SECRET_KEY` (server-only, bypasses RLS) instead of the legacy `ANON_KEY` / `SERVICE_ROLE_KEY`. The `createSupabaseServiceClient()` factory uses `SUPABASE_SECRET_KEY` and is only called from Server Actions or Route Handlers.
