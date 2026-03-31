# FNH Monolith — Implementation Plan

> **Last updated:** 2026-03-30
> **Status:** Phase 0 ✅ complete | Phase 1 ✅ complete | Phase 2 ✅ complete | Phase 3 ✅ complete | Phase 4 ✅ complete | Phase 5 ✅ complete | Phase 6 ✅ complete

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
│   ├── AppNav.tsx              ← 'use client'; nav shell (Panel/Contratos/Buses + sign out)
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
│   │   ├── contract-gen.js     ← rescued; converted to npm ES module (ND-12)
│   │   ├── security.js         ← rescued; converted to npm ES module (ND-12)
│   │   └── excel-importer.ts   ← two-phase import (ND-4)
│   ├── new/
│   │   └── page.tsx            ← contract creation: select employee/template → generate .docx → upload
│   ├── [id]/
│   │   ├── page.tsx            ← Server Component; fetches contract + audit log
│   │   └── ContractDetail.tsx  ← 'use client'; PDF upload, integrity check, delete
│   ├── import/
│   │   └── page.tsx            ← 'use client'; three-phase Excel import (upload→diff preview→confirm)
│   ├── templates/
│   │   └── page.tsx            ← 'use client'; template list, upload to Storage, delete with modal
│   ├── layout.tsx              ← thin wrapper importing AppNav (Phase 3 nav fix)
│   ├── page.tsx                ← contract list with estado badges + links to import/templates
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
| `contract-gen.js` | Browser-only: fills `.docx` template from variable map (docxtemplater + pizzip) |
| `security.js` | Browser-only: SHA-256 compute and verify via `window.crypto.subtle` |
| `excel-importer.ts` | Parse `.xlsx` (pure, no DOM); validate; return `ExcelImportResult` |
| `verify-integrity.ts` | Server Action: download PDF from Storage, re-compute SHA-256 via `node:crypto`, compare to `contracts.pdf_hash` |
| `expiry-calculator.ts` | Pure: `(expiry_date | null, today) → status` |
| `compliance-checker.ts` | Aggregate current document statuses for a VerificationPair |
| `report-builder.ts` | Execute Query A + B; assemble `GA_F_094_Report` |
| `api/cron/route.ts` | Daily batch: recalculate, notify, log |
| `(app)/AppNav.tsx` | Navigation shell (Panel / Contratos / Buses + sign out); 'use client'; active route via usePathname |
| `dashboard/layout.tsx`, `contracts/layout.tsx`, `buses/layout.tsx` | Thin per-segment wrappers that inject AppNav into pages outside the `(app)/` route group |
| `(shared)/lib/auth.ts` `requireRole()` | Throws if caller's role < minimum; called at top of every mutation Server Action |
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
| `app/globals.css` | OKLCH color tokens; dark mode default; cyan `#38c8d8` as sole accent; near-black background `oklch(0.08)` |
| `app/layout.tsx` | Geist (sans) + Geist Mono loaded; `dark` class on `<html>`; tab title shortened to "FNH" |
| `(app)/AppNav.tsx` | Redesigned: FNH logo in cyan, active route = cyan text only (no background), sticky + backdrop blur |

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
- **Page layout**: all pages use `max-w-5xl mx-auto` (lists) or `max-w-3xl mx-auto` (detail/forms); consistent `p-6 space-y-8`
- **Labels**: all form and section labels use `text-xs font-medium uppercase tracking-wide text-muted-foreground`
- **Buttons**: primary = `bg-primary text-primary-foreground font-semibold`; secondary = `border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30`
- **Tables**: header row `text-xs uppercase tracking-wide text-muted-foreground bg-muted/40`; row hover `bg-muted/20`; "Ver →" links transition to `text-primary`
- **StatusBadge**: semitransparent backgrounds (15% opacity) + matching border (20% opacity) — no solid color blocks
- **Status chips** (Firmado / Pendiente): `font-mono text-xs` with colored text + matching border/bg at low opacity; rounded-full pill shape
- **Detail Row component** (`ContractDetail`): label column `w-44 text-xs uppercase tracking-wide`; value optionally `font-mono`
- **PDF integrity result**: colored border+bg block with `font-mono text-[11px]` hash display

### Phase 6 — Features and UX Polish ✅
- **Email env vars**: `RESEND_FROM_EMAIL` and `NOTIFICATION_RECIPIENT` added to `.env.local`; notification system fully configured
- **Excel import UI** (`app/contracts/import/page.tsx`): three-phase client flow — file upload → browser-side parse + diff (no DB write) → user confirms → `confirmExcelImportAction()`. Shows stat cards (new/updated/unchanged), per-field diff table for updated rows, warnings list. Accessible from contracts list header
- **Template management UI** (`app/contracts/templates/page.tsx`): list all templates, upload `.docx` to `contracts/templates/` in Supabase Storage then register in DB, delete with confirmation modal (also removes Storage file). New db.ts functions: `createContractTemplate()`, `deleteContractTemplate()`. New Server Actions: `uploadTemplateAction()`, `deleteTemplateAction(storagePath)` — delete is Storage-first then DB
- **Lint script migration**: `"lint": "next lint"` → `"lint": "eslint ."` in `package.json`. ESLint 9 flat config (`eslint.config.mjs`) was already compatible; no config changes needed
- **E2E tests for buses + new pages** (`tests/buses.spec.ts`): 11 tests — driver form renders/validates/submits, vehicle form renders/validates/submits, verification form renders/validates, import page renders, templates page renders, contracts list shows import+templates links
- **UX navigation fixes**: all list pages (`buses/drivers`, `buses/vehicles`, `buses/verification`) now have `← Buses` breadcrumb link above heading
- **Phase 5 style consistency pass**: list pages (`buses/drivers`, `buses/vehicles`, `buses/verification`, `buses/page`, `contracts/page`) unified to Phase 5 standards — `max-w-5xl mx-auto`, `border-border bg-card` tables, `text-xs uppercase tracking-wide bg-muted/40` headers, `hover:bg-muted/20` rows, pill status chips with semitransparent color, "Ver →" `hover:text-primary`

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
RESEND_FROM_EMAIL                      ← e.g. "FNH <notificaciones@yourdomain.com>"
NOTIFICATION_RECIPIENT                 ← recipient email for all Alerta/Crítico alerts
```

> **Note on key naming**: Supabase projects with JWT disabled use `PUBLISHABLE_KEY` (browser-safe, no JWT signing) and `SECRET_KEY` (server-only, bypasses RLS) instead of the legacy `ANON_KEY` / `SERVICE_ROLE_KEY`. The `createSupabaseServiceClient()` factory uses `SUPABASE_SECRET_KEY` and is only called from Server Actions or Route Handlers.
