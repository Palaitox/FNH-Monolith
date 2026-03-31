-- ============================================================
-- FNH MONOLITH — Cron Load Test Seed
-- Purpose: insert 200 test vehicles with document event records
--          so the cron job can be tested at realistic scale.
--
-- Scale: 200 vehicles × 22 requirements = 4,400 event rows
-- (matches the target in Phase 4: "load test cron with
--  200 vehicles × 22 documents")
--
-- WARNING: This script is for development/staging ONLY.
-- Run the cleanup query at the bottom to remove test data.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

do $$
declare
  v_id        uuid;
  req_ids     uuid[];
  req_id      uuid;
  i           int;
  expiry_days int;
  expiry_dt   date;
  status_val  text;
begin

  -- ── Collect all vehicle requirement IDs ──────────────────
  select array_agg(id)
    into req_ids
    from document_requirements
   where category = 'vehicle'
     and effective_to is null;

  if array_length(req_ids, 1) is null then
    raise exception 'No vehicle requirements found — run 0003_seed_document_requirements.sql first';
  end if;

  -- ── Insert 200 test vehicles ──────────────────────────────
  for i in 1..200 loop
    insert into vehicles (plate, type)
    values (
      'TST' || lpad(i::text, 4, '0'),   -- e.g. TST0001 … TST0200
      case when i % 5 = 0 then 'reemplazo' else 'titular' end
    )
    on conflict (plate) do nothing
    returning id into v_id;

    -- If the vehicle already existed (conflict), fetch its id
    if v_id is null then
      select id into v_id from vehicles where plate = 'TST' || lpad(i::text, 4, '0');
    end if;

    -- ── Insert one event per requirement ───────────────────
    foreach req_id in array req_ids loop
      -- Spread expiry dates to exercise all four status buckets:
      --   Vigente    (> 90 days)
      --   Seguimiento(61–90 days)
      --   Alerta     (22–60 days)
      --   Crítico    (≤ 21 days or null)
      expiry_days := (i + (req_id::text)::bigint % 128)::int % 150;

      if expiry_days = 0 then
        -- ~1-in-150 chance: null expiry (always Crítico)
        expiry_dt  := null;
        status_val := 'Crítico';
      elsif expiry_days <= 21 then
        expiry_dt  := current_date + expiry_days;
        status_val := 'Crítico';
      elsif expiry_days <= 60 then
        expiry_dt  := current_date + expiry_days;
        status_val := 'Alerta';
      elsif expiry_days <= 90 then
        expiry_dt  := current_date + expiry_days;
        status_val := 'Seguimiento';
      else
        expiry_dt  := current_date + expiry_days;
        status_val := 'Vigente';
      end if;

      insert into vehicle_document_events (
        vehicle_id,
        requirement_id,
        expiry_date,
        is_illegible,
        computed_status,
        previous_status,
        recorded_by
      ) values (
        v_id,
        req_id,
        expiry_dt,
        false,
        status_val,
        null,
        null       -- cron-style: no recorded_by
      );
    end loop;

  end loop;

  raise notice 'Seeded 200 test vehicles with % requirements each (% total event rows)',
    array_length(req_ids, 1),
    200 * array_length(req_ids, 1);

end $$;


-- ============================================================
-- VERIFICATION
-- Expected: 200 rows with plate like TST%
-- ============================================================
-- select count(*) from vehicles where plate like 'TST%';
-- select count(*) from vehicle_document_events vde
--   join vehicles v on v.id = vde.vehicle_id
--   where v.plate like 'TST%';


-- ============================================================
-- CLEANUP — run when done testing
-- ============================================================
-- delete from vehicle_document_events
--   where vehicle_id in (select id from vehicles where plate like 'TST%');
-- delete from vehicles where plate like 'TST%';
