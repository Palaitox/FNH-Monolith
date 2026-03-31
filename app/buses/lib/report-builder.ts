/**
 * report-builder.ts
 *
 * Executes the canonical Query A (driver documents) and Query B (vehicle documents)
 * for a given verification pair, returning a GA_F_094_Report.
 *
 * These queries are the authoritative historical reconstruction queries from
 * decisions.md (ND-5, ND-6, ND-7). They must NOT be modified to filter by
 * current state or any present-day status column.
 *
 * See: decisions.md.md — Historical Reconstruction Canonical Queries
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  GA_F_094_Report,
  GA_F_094_DocumentRow,
  DocumentStatus,
  VerificationPairWithEntities,
} from '@/app/buses/types'

export async function buildGA_F_094_Report(
  supabase: SupabaseClient,
  pairId: string,
): Promise<GA_F_094_Report | null> {
  // Fetch the verification pair with entity data
  const { data: pair, error: pairErr } = await supabase
    .from('verification_pairs')
    .select('*, vehicles(id, plate, type), drivers(id, full_name, cedula)')
    .eq('id', pairId)
    .single()

  if (pairErr || !pair) return null

  const p = pair as VerificationPairWithEntities & {
    vehicles: { id: string; plate: string; type: string } | null
    drivers: { id: string; full_name: string; cedula: string } | null
  }

  if (!p.vehicles || !p.drivers) return null

  const verifiedAt = p.verified_at

  // Run Query A and Query B in parallel
  const [driverDocs, vehicleDocs] = await Promise.all([
    runQueryA(supabase, p.driver_id, verifiedAt),
    runQueryB(supabase, p.vehicle_id, verifiedAt),
  ])

  return {
    pair_id: pairId,
    verified_at: verifiedAt,
    verified_by: p.verified_by,
    vehicle: {
      id: p.vehicles.id,
      plate: p.vehicles.plate,
      type: p.vehicles.type as 'titular' | 'reemplazo',
    },
    driver: {
      id: p.drivers.id,
      full_name: p.drivers.full_name,
      cedula: p.drivers.cedula,
    },
    driver_documents: driverDocs,
    vehicle_documents: vehicleDocs,
    generated_at: new Date().toISOString(),
  }
}

// ── Query A — Driver documents at verification time ────────────────────────
// Mirrors the canonical SQL from decisions.md, executed in JS via Supabase client.

async function runQueryA(
  supabase: SupabaseClient,
  driverId: string,
  verifiedAt: string,
): Promise<GA_F_094_DocumentRow[]> {
  const verifiedAtDate = verifiedAt.slice(0, 10)

  const { data, error } = await supabase
    .from('driver_document_events')
    .select(
      `requirement_id, expiry_date, is_illegible, computed_status, recorded_at,
       document_requirements!inner(name, effective_from, effective_to),
       drivers!inner(deactivated_at)`,
    )
    .eq('driver_id', driverId)
    .lte('recorded_at', verifiedAt)
    .lte('document_requirements.effective_from', verifiedAtDate)
    .order('recorded_at', { ascending: false })

  if (error) throw new Error(`report-builder Query A: ${error.message}`)

  return applyDistinctOn(
    (data ?? []) as unknown as RawEventRow[],
    verifiedAt,
    verifiedAtDate,
  )
}

// ── Query B — Vehicle documents at verification time ───────────────────────

async function runQueryB(
  supabase: SupabaseClient,
  vehicleId: string,
  verifiedAt: string,
): Promise<GA_F_094_DocumentRow[]> {
  const verifiedAtDate = verifiedAt.slice(0, 10)

  const { data, error } = await supabase
    .from('vehicle_document_events')
    .select(
      `requirement_id, expiry_date, is_illegible, computed_status, recorded_at,
       document_requirements!inner(name, effective_from, effective_to),
       vehicles!inner(deactivated_at)`,
    )
    .eq('vehicle_id', vehicleId)
    .lte('recorded_at', verifiedAt)
    .lte('document_requirements.effective_from', verifiedAtDate)
    .order('recorded_at', { ascending: false })

  if (error) throw new Error(`report-builder Query B: ${error.message}`)

  return applyDistinctOn(
    (data ?? []) as unknown as RawEventRow[],
    verifiedAt,
    verifiedAtDate,
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────

interface RawEventRow {
  requirement_id: string
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
  recorded_at: string
  document_requirements: {
    name: string
    effective_from: string
    effective_to: string | null
  }
  drivers?: { deactivated_at: string | null }
  vehicles?: { deactivated_at: string | null }
}

/**
 * Replicates DISTINCT ON (requirement_id) ORDER BY recorded_at DESC in JS.
 * Applies all four WHERE filters from the canonical queries:
 *   1. recorded_at <= :verified_at         (done by Supabase .lte)
 *   2. effective_from <= :verified_at::date (done by Supabase .lte on joined col)
 *   3. effective_to IS NULL OR effective_to > :verified_at::date
 *   4. entity.deactivated_at IS NULL OR deactivated_at > :verified_at
 */
function applyDistinctOn(
  rows: RawEventRow[],
  verifiedAt: string,
  verifiedAtDate: string,
): GA_F_094_DocumentRow[] {
  const seen = new Set<string>()
  const result: GA_F_094_DocumentRow[] = []

  for (const row of rows) {
    if (seen.has(row.requirement_id)) continue

    const req = row.document_requirements

    // Filter 3: requirement effectivity_to
    if (req.effective_to && req.effective_to <= verifiedAtDate) continue

    // Filter 4: entity deactivation guard
    const entityDeactivatedAt =
      row.drivers?.deactivated_at ?? row.vehicles?.deactivated_at ?? null
    if (entityDeactivatedAt && entityDeactivatedAt <= verifiedAt) continue

    seen.add(row.requirement_id)
    result.push({
      requirement_id: row.requirement_id,
      requirement_name: req.name,
      expiry_date: row.expiry_date,
      is_illegible: row.is_illegible,
      computed_status: row.computed_status,
    })
  }

  // Sort by name for consistent report layout
  result.sort((a, b) => a.requirement_name.localeCompare(b.requirement_name, 'es'))
  return result
}
