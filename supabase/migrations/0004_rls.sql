-- ============================================================
-- FNH MONOLITH — Row Level Security
-- Apply via: Supabase Dashboard → SQL Editor → Run
--
-- Design:
--   admin      — full read/write on all tables
--   coordinator — full read/write on operational tables; no write on config/templates/req
--   viewer     — read-only on all tables
--   cron       — writes via SUPABASE_SECRET_KEY (service role) which bypasses RLS entirely
--
-- Pattern:
--   All reads   → authenticated users with any role (using (true))
--   Mutations   → role-gated via get_my_role() SECURITY DEFINER helper
--
-- The get_my_role() function is SECURITY DEFINER so it can read public.users
-- even after RLS is enabled on that table (avoids circular dependency).
-- ============================================================

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

-- Returns the calling user's role without being blocked by RLS on public.users.
-- SECURITY DEFINER + explicit search_path prevents search-path injection.
create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;


-- ============================================================
-- SHARED KERNEL
-- ============================================================

-- ── users ──────────────────────────────────────────────────
alter table public.users enable row level security;

-- Each authenticated user can read their own row (needed for getUserRole())
create policy "users_select_own"
  on public.users for select
  to authenticated
  using (id = auth.uid());

-- Admin can read all users
create policy "users_select_admin"
  on public.users for select
  to authenticated
  using (get_my_role() = 'admin');

-- Admin can insert new users (e.g. provisioning)
create policy "users_insert_admin"
  on public.users for insert
  to authenticated
  with check (get_my_role() = 'admin');

-- Admin can update users (e.g. change role)
create policy "users_update_admin"
  on public.users for update
  to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');


-- ── system_logs ────────────────────────────────────────────
-- Cron writes via service key (bypasses RLS). Admins can read.
alter table public.system_logs enable row level security;

create policy "system_logs_select_admin"
  on public.system_logs for select
  to authenticated
  using (get_my_role() = 'admin');


-- ============================================================
-- CONTRACTS MODULE
-- ============================================================

-- ── contract_templates ─────────────────────────────────────
alter table public.contract_templates enable row level security;

-- All authenticated users can list/select templates (needed to populate forms)
create policy "templates_select_all"
  on public.contract_templates for select
  to authenticated
  using (true);

-- Admin only: add/modify templates (content governance)
create policy "templates_insert_admin"
  on public.contract_templates for insert
  to authenticated
  with check (get_my_role() = 'admin');

create policy "templates_update_admin"
  on public.contract_templates for update
  to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');

create policy "templates_delete_admin"
  on public.contract_templates for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ── employees ──────────────────────────────────────────────
alter table public.employees enable row level security;

create policy "employees_select_all"
  on public.employees for select
  to authenticated
  using (true);

create policy "employees_insert_coord_admin"
  on public.employees for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "employees_update_coord_admin"
  on public.employees for update
  to authenticated
  using (get_my_role() in ('admin', 'coordinator'))
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "employees_delete_admin"
  on public.employees for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ── contracts ──────────────────────────────────────────────
alter table public.contracts enable row level security;

create policy "contracts_select_all"
  on public.contracts for select
  to authenticated
  using (true);

create policy "contracts_insert_coord_admin"
  on public.contracts for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "contracts_update_coord_admin"
  on public.contracts for update
  to authenticated
  using (get_my_role() in ('admin', 'coordinator'))
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "contracts_delete_admin"
  on public.contracts for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ── contract_audit_logs ────────────────────────────────────
-- Immutable: insert only (no updates, no deletes).
-- All authenticated can read audit trails (transparency).
alter table public.contract_audit_logs enable row level security;

create policy "audit_select_all"
  on public.contract_audit_logs for select
  to authenticated
  using (true);

create policy "audit_insert_coord_admin"
  on public.contract_audit_logs for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));


-- ── config ─────────────────────────────────────────────────
alter table public.config enable row level security;

create policy "config_select_all"
  on public.config for select
  to authenticated
  using (true);

create policy "config_write_admin"
  on public.config for insert
  to authenticated
  with check (get_my_role() = 'admin');

create policy "config_update_admin"
  on public.config for update
  to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');


-- ============================================================
-- BUSES MODULE — ENTITIES
-- ============================================================

-- ── vehicles ───────────────────────────────────────────────
alter table public.vehicles enable row level security;

create policy "vehicles_select_all"
  on public.vehicles for select
  to authenticated
  using (true);

create policy "vehicles_insert_coord_admin"
  on public.vehicles for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));

-- Deactivation is an UPDATE (deactivated_at = now())
create policy "vehicles_update_coord_admin"
  on public.vehicles for update
  to authenticated
  using (get_my_role() in ('admin', 'coordinator'))
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "vehicles_delete_admin"
  on public.vehicles for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ── drivers ────────────────────────────────────────────────
alter table public.drivers enable row level security;

create policy "drivers_select_all"
  on public.drivers for select
  to authenticated
  using (true);

create policy "drivers_insert_coord_admin"
  on public.drivers for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "drivers_update_coord_admin"
  on public.drivers for update
  to authenticated
  using (get_my_role() in ('admin', 'coordinator'))
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "drivers_delete_admin"
  on public.drivers for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ── verification_pairs ─────────────────────────────────────
alter table public.verification_pairs enable row level security;

create policy "pairs_select_all"
  on public.verification_pairs for select
  to authenticated
  using (true);

create policy "pairs_insert_coord_admin"
  on public.verification_pairs for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "pairs_update_coord_admin"
  on public.verification_pairs for update
  to authenticated
  using (get_my_role() in ('admin', 'coordinator'))
  with check (get_my_role() in ('admin', 'coordinator'));

create policy "pairs_delete_admin"
  on public.verification_pairs for delete
  to authenticated
  using (get_my_role() = 'admin');


-- ============================================================
-- BUSES MODULE — DOCUMENT REQUIREMENTS
-- ============================================================

-- All authenticated can read (needed for compliance dashboard and forms).
-- Admin only writes (requirement changes are governance decisions).
alter table public.document_requirements enable row level security;

create policy "req_select_all"
  on public.document_requirements for select
  to authenticated
  using (true);

create policy "req_insert_admin"
  on public.document_requirements for insert
  to authenticated
  with check (get_my_role() = 'admin');

create policy "req_update_admin"
  on public.document_requirements for update
  to authenticated
  using (get_my_role() = 'admin')
  with check (get_my_role() = 'admin');


-- ============================================================
-- BUSES MODULE — DOCUMENT EVENT LOGS (append-only)
-- ============================================================

-- Manual recording: coord+admin insert.
-- Cron recalculation: service key (bypasses RLS) — no policy needed.
-- No UPDATE or DELETE policies — event rows are immutable by convention.

alter table public.driver_document_events enable row level security;

create policy "dde_select_all"
  on public.driver_document_events for select
  to authenticated
  using (true);

create policy "dde_insert_coord_admin"
  on public.driver_document_events for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));


alter table public.vehicle_document_events enable row level security;

create policy "vde_select_all"
  on public.vehicle_document_events for select
  to authenticated
  using (true);

create policy "vde_insert_coord_admin"
  on public.vehicle_document_events for insert
  to authenticated
  with check (get_my_role() in ('admin', 'coordinator'));


-- ============================================================
-- BUSES MODULE — NOTIFICATIONS
-- ============================================================

-- Cron writes and retries via service key (bypasses RLS).
-- Admin-only read for operational inspection.
alter table public.notification_log enable row level security;

create policy "notif_select_admin"
  on public.notification_log for select
  to authenticated
  using (get_my_role() = 'admin');
