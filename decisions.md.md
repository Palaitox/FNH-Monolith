# FNH Monolith — Design Decisions

## Named Decisions Register

| ID | Decision | Rationale |
|---|---|---|
| ND-1 | ~~Notification trigger: insert into notification_log only when new_status ≠ previous_status OR (new_status is Alerta/Crítico AND no sent row exists today for this event_id).~~ **Superseded by ND-24.** Notifications fire only on Crítico transitions (previous ≠ Crítico, new = Crítico). No Alerta emails. No repeated-state emails. | Original Branch 2 always fired because each cron run inserts a fresh event_id, making the "no sent row today" check trivially true. The two-branch condition caused daily email spam for persistent Crítico state. Replaced by strict transition detection. |
| ND-2 | Module boundaries enforced by ESLint boundaries plugin at CI. contracts/ and buses/ may only import from (shared)/. | Convention alone is not enforcement. |
| ND-3 | No materialized view. Current status always queried via DISTINCT ON (requirement_id) ORDER BY recorded_at DESC with indexes. | Stale-read risk with zero performance benefit at this scale. |
| ND-4 | Excel import is two-phase: parse+validate → user confirms → upsert. No DB write before confirmation. On conflict by cedula: update. | Prevents silent data corruption. |
| ND-5 | compliance_snapshots table does not exist. GA-F-094 always reconstructed from event tables at request time. | Snapshot tables can diverge from event log. Event-sourced reconstruction is authoritative. |
| ND-6 | Driver documents are owned by the Driver entity, not by a VerificationPair. | A driver's licence belongs to the driver, not to a bus assignment. |
| ND-7 | verified_at is an explicit user-input field. now() is never used as the verification date. | Multi-day verifications must be representable. |
| ND-8 | No uniqueness constraint on (vehicle_id, driver_id, verified_at). Multiple verifications of the same pair on the same day are allowed. | Corrections and re-verifications are normal operational patterns. |
| ND-9 | ~~All drivers share the same 16-document requirement set (generic MinTransporte list).~~ **Updated by migration 0007.** All drivers share the SERVITRANS-specific 16-document onboarding checklist: 15 binary checklist items (has_expiry=false) + 1 dated document (Licencia de conducción C2, has_expiry=true). Extension path: add driver_category to drivers and required_for_category to document_requirements. | SERVITRANS has a specific onboarding checklist that differs from generic MinTransporte requirements. The 15 binary items can only be recorded once (append-only; once checked they cannot be unchecked). Only Licencia C2 has an expiry date. |
| ND-10 | `contract_audit_logs.user_id` is a soft reference with no foreign key. Audit records survive user deletion. `user_email` is stored as a redundant text column at insert time. | Forensic records must be immutable and self-describing. If the FK existed, `ON DELETE CASCADE` would destroy the audit trail when a user account is removed. `ON DELETE SET NULL` would preserve the row but lose the email. Neither is acceptable for compliance purposes. |
| ND-11 | `xlsx` dependency replaced with `npm:@e965/xlsx@^0.20.3` (community security fork). The import alias in `package.json` keeps all import paths identical to the original. | The original `sheetjs-ce` (xlsx) had two active CVEs: prototype pollution via crafted .xlsx files and a ReDoS vulnerability in formula parsing. The `@e965/xlsx` fork patches both without an API break. npm overrides cannot patch a direct dependency; the direct dependency must be replaced. |
| ND-12 | `contract-gen.js` and `security.js` were converted from CDN IIFE globals to npm ES module imports (`import PizZip from 'pizzip'`, `import Docxtemplater from 'docxtemplater'`, `import { saveAs } from 'file-saver'`). All function bodies are unchanged. Both files remain browser-only. | Next.js App Router cannot bundle CDN global assignments (`window.PizZip = ...`). The conversion was minimal — only the module preamble changed. The browser-only constraint is unchanged: `contract-gen.js` uses `atob` and `saveAs`; `security.js` uses `window.crypto.subtle`. Neither may be imported in Server Components or Server Actions. |
| ND-13 | Supabase SSR middleware uses `supabase.auth.getClaims()` (local JWT read) instead of `supabase.auth.getUser()` (server round-trip). | `getUser()` makes an HTTP request to the Supabase Auth server on every request that hits middleware. At the Vercel Edge, this adds ~50–200ms of latency per navigation. `getClaims()` reads the claims from the signed JWT in the cookie without a network call — zero added latency, and the JWT signature guarantees authenticity. The tradeoff: claims are only as fresh as the JWT expiry (1 hour by default). For role enforcement this is acceptable; revocation within the JWT window requires an explicit session invalidation. |
| ND-14 | `DISTINCT ON (requirement_id) ORDER BY recorded_at DESC` is replicated in application code (TypeScript) rather than at the database layer, for both `compliance-checker.ts` and `report-builder.ts`. | The Supabase JS client does not support PostgreSQL's `DISTINCT ON` syntax in its query builder. The alternative (raw SQL via `supabase.rpc()` or `supabase.from().select()` with a custom RPC function) would require creating database functions, adding schema migration surface, and coupling TypeScript types to PL/pgSQL signatures. At the current event log scale (≤ 200 vehicles × 22 documents = 4,400 active pairs) the in-memory dedup is negligible. The authoritative SQL form is preserved in `decisions.md.md` (Query A + Query B) as the canonical definition; the JS replication is an implementation detail that follows the same WHERE conditions exactly. |
| ND-15 | The cron job skips any (entity × requirement) pair that has no prior event row in the database. Initial document entry is always manual. | The cron recalculates status from the most recent recorded expiry date. If no event row exists, there is no expiry date to recalculate from — inserting a synthetic Crítico row would pollute the event log with fabricated history. The correct signal for "document never recorded" is the absence of a row, not a computed status. The compliance dashboard surfaces this as a missing entry rather than a status badge. |
| ND-16 | RLS role checks use a `get_my_role() SECURITY DEFINER` SQL function rather than JWT claims or a plain subquery. |
| ND-17 | `public.users` column is `name` (not `full_name`). The migration draft said `full_name` but the table was created manually with `name`. No code touches `users.name` outside of direct SQL inserts; application code reads only `users.role`. | Enabling RLS on `public.users` creates a circular dependency: a policy that reads `users.role` to authorize access to `users` blocks itself. `SECURITY DEFINER` makes the function run as its owner (bypassing RLS), breaking the cycle. The alternative — storing the role in JWT app_metadata via a Supabase Auth hook — would couple role management to the Auth service and require a re-login on every role change. The SECURITY DEFINER function avoids both problems with a single 4-line SQL definition. `set search_path = public` prevents search-path injection attacks on the definer function. |
| ND-18 | UI uses a single accent color (cyan `#38c8d8`) with no gradients, no shadows heavier than `border-border`, and no decorative elements. `Geist Mono` is used exclusively for machine-identifiers (contract numbers, cédulas, vehicle plates, dates, hashes); `Geist` sans-serif for all prose and UI text. Dark mode (`oklch(0.08)` background) is the app default, applied via `dark` class on `<html>`. | A reduced palette with one semantic accent and a mono/sans split creates a legible, professional hierarchy without visual noise. Hard-coding `dark` as default avoids a flash-of-incorrect-theme on load (no `localStorage`/cookie dance required). The `oklch` color space ensures perceptually uniform contrast ratios across the palette without HSL distortion at high chroma. |
| ND-19 | Template deletion removes the Storage object first (best-effort, error swallowed), then deletes the DB row. If Storage removal fails silently, the DB row is still deleted. | A dangling Storage file is cheaper than a dangling DB row. A DB row without a Storage file causes a broken download on the next contract generation. A Storage file without a DB row is invisible to the application and can be cleaned up manually. The Storage call is wrapped in `.catch(() => {})` so a transient Storage error never blocks the DB deletion. |
| ND-20 | `"lint"` script uses `eslint .` (ESLint CLI) instead of `next lint`. The flat config in `eslint.config.mjs` extends `next/core-web-vitals` and `next/typescript` via `@eslint/eslintrc` FlatCompat. | `next lint` wraps ESLint but does not support ESLint 9 flat config or `eslint-plugin-boundaries`. Direct ESLint CLI invocation gives full control over the flat config and is the path recommended by the Next.js docs for custom plugin setups. |
| ND-21 | `@typescript-eslint/no-unused-vars` is configured with `ignoreRestSiblings: true` in `eslint.config.mjs`. | The pattern `({ source, ...e }) => e` (destructure a field solely to exclude it from a rest spread) is idiomatic TypeScript for stripping a type discriminant before passing to a Server Action. Without `ignoreRestSiblings`, the linter incorrectly flags `source` as unused. This option is the standard TSLint/typescript-eslint escape hatch for this exact pattern — it does not weaken the rule for any other case. |
| ND-22 | `computeStatus(expiryDate, hasExpiry, today)` takes an explicit `hasExpiry: boolean` parameter. When `hasExpiry=false`, it returns `'Vigente'` immediately without inspecting `expiryDate`. | Before this change, documents with `has_expiry=false` and no `expiry_date` (e.g. Licencia de tránsito) would return `'Crítico'` because `expiryDate=null → Crítico` was the null branch. Checklist documents have no expiry by definition; their status is always `'Vigente'` once recorded. The `hasExpiry` param threads through the full stack: `expiry-calculator.ts`, `compliance-checker.ts`, `fleet-compliance.ts`, both record actions, and the cron handler. |
| ND-23 | `compliance-checker.ts` recomputes status from source truth (`expiry_date` + `has_expiry`) via `computeStatus()` rather than reading the stored `computed_status` column. | The stored `computed_status` is written at record time using the logic that existed then. If the logic changes (e.g. ND-22 adding `hasExpiry`), old rows retain the stale status. Recomputing live from `expiry_date` + `has_expiry` means any logic fix automatically applies to all historical events on the next compliance fetch. `fleet-compliance.ts` follows the same pattern. |
| ND-24 | Notification rule: one email per Crítico transition. Fires at record-time (via `recordDriverDocumentsAction` / `recordVehicleDocumentsAction`) for documents that enter Crítico when manually recorded. Fires at cron-time for day-over-day crossings. No Alerta emails. No repeated-state emails (i.e. no email when a doc stays Crítico). | Alerta is a monitoring signal for the dashboard, not an action trigger. Repeated-state emails for persistent Crítico would produce daily noise and desensitize recipients. The dashboard surfaces persistent Crítico items. The original two-branch notify condition (ND-1) always re-fired because new event_id was always fresh. |
| ND-25 | SERVITRANS driver checklist is append-only: once a checklist item is recorded as checked (or a C2 expiry date is recorded), it cannot be unchecked. The DriverDetail form disables already-recorded checkboxes and only submits newly-checked items + newly-dated items. | The event log has no `DELETE` mechanism. An "unchecked" operation would require a compensating event, which is not modeled. The append-only constraint maps to the physical operation: an onboarding doc is either presented or not; retracting it is a physical action outside the system. If retraction is needed, a coordinator must delete the driver and re-create. |
| ND-26 | `missingCount > 0` forces an entity's overall fleet compliance status to `'Crítico'`, overriding any computed `worstStatus`. | An entity with all docs in `'Vigente'` but with unrecorded requirements is indistinguishable from a compliant entity in the status aggregation. `missingCount` is the mechanism that surfaces this gap. `fleet-compliance.ts` uses per-category `reqMaps` (`driverReqMap` / `vehicleReqMap`) to count only the requirements applicable to each entity type, preventing cross-contamination. |
| ND-27 | `deleteDriverAction` performs a cascade delete in application code: `driver_document_events` → `verification_pairs` → `drivers`, in that order. | The `drivers` table has `FK RESTRICT` from both `driver_document_events` and `verification_pairs`. Supabase does not support `ON DELETE CASCADE` through the JS client's `delete()` chain. Deleting dependents first in application code is the only option without a migration to change FK constraints. Two-click confirmation is required in the UI before calling this action. |

---

## Historical Reconstruction Canonical Queries

These queries are the authoritative implementation for report-builder.ts.
Never modify them to filter by current state, is_active, or any 
present-day status column.

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

### Parameters

| Parameter | Source | Type |
|---|---|---|
| :driver_id | verification_pairs.driver_id | uuid |
| :vehicle_id | verification_pairs.vehicle_id | uuid |
| :verified_at | verification_pairs.verified_at | timestamptz |