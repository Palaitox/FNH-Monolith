/**
 * compliance-checker.ts
 *
 * Queries the current document status for a driver or vehicle by reading
 * the latest event per requirement (DISTINCT ON pattern via Supabase).
 *
 * "Current" = most recent recorded_at, regardless of calendar date.
 * The cron job is responsible for inserting daily events; this module
 * only reads whatever is already in the event tables.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ComplianceResult,
  DocumentStatus,
  DocumentStatusRow,
} from '@/app/buses/types'
import { worstStatus, STATUS_SEVERITY } from './expiry-calculator'

/**
 * Returns the current compliance status for a driver.
 * Uses a raw SQL query to execute the DISTINCT ON pattern efficiently.
 */
export async function getDriverCompliance(
  supabase: SupabaseClient,
  driverId: string,
  asOf: Date = new Date(),
): Promise<ComplianceResult> {
  const asOfIso = asOf.toISOString()

  // Supabase JS client doesn't expose DISTINCT ON directly.
  // We use rpc() with a stored procedure OR replicate the logic by fetching
  // all events and grouping in JS (acceptable at ≤200 vehicles × 22 docs).
  const { data, error } = await supabase
    .from('driver_document_events')
    .select(
      `id, requirement_id, expiry_date, is_illegible, computed_status, recorded_at,
       document_requirements!inner(name, has_expiry, effective_from, effective_to)`,
    )
    .eq('driver_id', driverId)
    .lte('recorded_at', asOfIso)
    .order('recorded_at', { ascending: false })

  if (error) throw new Error(`compliance-checker: ${error.message}`)

  const rows = buildDistinctRows(
    (data ?? []) as unknown as RawDriverEvent[],
    asOf,
  )

  return buildResult(driverId, 'driver', rows)
}

/**
 * Returns the current compliance status for a vehicle.
 */
export async function getVehicleCompliance(
  supabase: SupabaseClient,
  vehicleId: string,
  asOf: Date = new Date(),
): Promise<ComplianceResult> {
  const asOfIso = asOf.toISOString()

  const { data, error } = await supabase
    .from('vehicle_document_events')
    .select(
      `id, requirement_id, expiry_date, is_illegible, computed_status, recorded_at,
       document_requirements!inner(name, has_expiry, effective_from, effective_to)`,
    )
    .eq('vehicle_id', vehicleId)
    .lte('recorded_at', asOfIso)
    .order('recorded_at', { ascending: false })

  if (error) throw new Error(`compliance-checker: ${error.message}`)

  const rows = buildDistinctRows(
    (data ?? []) as unknown as RawDriverEvent[],
    asOf,
  )

  return buildResult(vehicleId, 'vehicle', rows)
}

// ── Internal helpers ────────────────────────────────────────────────────────

interface RawDriverEvent {
  requirement_id: string
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
  recorded_at: string
  document_requirements: {
    name: string
    has_expiry: boolean
    effective_from: string
    effective_to: string | null
  }
}

/**
 * Replicates DISTINCT ON (requirement_id) ORDER BY recorded_at DESC in JS.
 * Also filters requirements by effectivity window.
 */
function buildDistinctRows(
  events: RawDriverEvent[],
  asOf: Date,
): DocumentStatusRow[] {
  const asOfDate = asOf.toISOString().slice(0, 10)
  const seen = new Set<string>()
  const rows: DocumentStatusRow[] = []

  for (const ev of events) {
    if (seen.has(ev.requirement_id)) continue

    const req = ev.document_requirements
    // Requirement effectivity filter (mirrors Query A/B WHERE conditions)
    if (req.effective_from > asOfDate) continue
    if (req.effective_to && req.effective_to <= asOfDate) continue

    seen.add(ev.requirement_id)
    rows.push({
      requirement_id: ev.requirement_id,
      requirement_name: req.name,
      has_expiry: req.has_expiry,
      expiry_date: ev.expiry_date,
      is_illegible: ev.is_illegible,
      computed_status: ev.computed_status,
      recorded_at: ev.recorded_at,
    })
  }

  // Sort by status severity desc, then name asc
  rows.sort((a, b) => {
    const diff = STATUS_SEVERITY[b.computed_status] - STATUS_SEVERITY[a.computed_status]
    return diff !== 0 ? diff : a.requirement_name.localeCompare(b.requirement_name)
  })

  return rows
}

function buildResult(
  entityId: string,
  entityType: 'driver' | 'vehicle',
  rows: DocumentStatusRow[],
): ComplianceResult {
  const statuses = rows.map((r) => r.computed_status)

  const counts: Record<DocumentStatus, number> = {
    Vigente: 0,
    Seguimiento: 0,
    Alerta: 0,
    Crítico: 0,
  }
  for (const s of statuses) counts[s]++

  return {
    entity_id: entityId,
    entity_type: entityType,
    rows,
    overall: worstStatus(statuses),
    counts,
  }
}
