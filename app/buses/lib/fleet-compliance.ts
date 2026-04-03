/**
 * fleet-compliance.ts
 *
 * Computes compliance status for the entire active fleet in exactly 5 queries:
 *   1. active drivers
 *   2. active vehicles
 *   3. all driver_document_events for those drivers  (filtered by .in())
 *   4. all vehicle_document_events for those vehicles (filtered by .in())
 *   5. all document_requirements
 *
 * Then groups events in memory with the same DISTINCT ON (requirement_id)
 * ORDER BY recorded_at DESC logic used in compliance-checker.ts.
 *
 * This avoids N+1 queries when rendering the dashboard.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DocumentStatus,
  EntityComplianceSummary,
  FleetComplianceSummary,
} from '@/app/buses/types'
import { computeStatus, worstStatus, STATUS_SEVERITY } from './expiry-calculator'

export async function getFleetCompliance(
  supabase: SupabaseClient,
): Promise<FleetComplianceSummary> {
  const now = new Date()
  const asOfIso = now.toISOString()
  const asOfDate = asOfIso.slice(0, 10)

  // ── 1 + 2: active drivers and vehicles ───────────────────────────────────
  const [driversRes, vehiclesRes] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, full_name')
      .is('deactivated_at', null),
    supabase
      .from('vehicles')
      .select('id, plate')
      .is('deactivated_at', null),
  ])

  const drivers = (driversRes.data ?? []) as { id: string; full_name: string }[]
  const vehicles = (vehiclesRes.data ?? []) as { id: string; plate: string }[]

  const driverIds = drivers.map((d) => d.id)
  const vehicleIds = vehicles.map((v) => v.id)

  // ── 3 + 4 + 5: events and requirements in parallel ────────────────────────
  const [driverEventsRes, vehicleEventsRes, reqsRes] = await Promise.all([
    driverIds.length > 0
      ? supabase
          .from('driver_document_events')
          .select('driver_id, requirement_id, expiry_date, computed_status, recorded_at')
          .in('driver_id', driverIds)
          .lte('recorded_at', asOfIso)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as RawDriverEvent[], error: null }),

    vehicleIds.length > 0
      ? supabase
          .from('vehicle_document_events')
          .select('vehicle_id, requirement_id, expiry_date, computed_status, recorded_at')
          .in('vehicle_id', vehicleIds)
          .lte('recorded_at', asOfIso)
          .order('recorded_at', { ascending: false })
      : Promise.resolve({ data: [] as RawVehicleEvent[], error: null }),

    supabase
      .from('document_requirements')
      .select('id, name, has_expiry, effective_from, effective_to'),
  ])

  const driverEvents = (driverEventsRes.data ?? []) as RawDriverEvent[]
  const vehicleEvents = (vehicleEventsRes.data ?? []) as RawVehicleEvent[]
  const requirements = (reqsRes.data ?? []) as RawRequirement[]

  // ── Build effectivity-filtered requirement map ────────────────────────────
  const reqMap = new Map<string, { name: string; has_expiry: boolean }>()
  for (const req of requirements) {
    if (req.effective_from > asOfDate) continue
    if (req.effective_to && req.effective_to <= asOfDate) continue
    reqMap.set(req.id, { name: req.name, has_expiry: req.has_expiry })
  }

  // ── Group raw events by entity id ─────────────────────────────────────────
  const driverEventsMap = new Map<string, RawDriverEvent[]>()
  for (const ev of driverEvents) {
    const arr = driverEventsMap.get(ev.driver_id) ?? []
    arr.push(ev)
    driverEventsMap.set(ev.driver_id, arr)
  }

  const vehicleEventsMap = new Map<string, RawVehicleEvent[]>()
  for (const ev of vehicleEvents) {
    const arr = vehicleEventsMap.get(ev.vehicle_id) ?? []
    arr.push(ev)
    vehicleEventsMap.set(ev.vehicle_id, arr)
  }

  // ── Build per-entity summaries ────────────────────────────────────────────
  const entities: EntityComplianceSummary[] = [
    ...drivers.map((d) =>
      buildEntitySummary(
        d.id,
        d.full_name,
        'driver',
        (driverEventsMap.get(d.id) ?? []).map((e) => ({
          requirement_id: e.requirement_id,
          expiry_date: e.expiry_date,
        })),
        reqMap,
      ),
    ),
    ...vehicles.map((v) =>
      buildEntitySummary(
        v.id,
        v.plate,
        'vehicle',
        (vehicleEventsMap.get(v.id) ?? []).map((e) => ({
          requirement_id: e.requirement_id,
          expiry_date: e.expiry_date,
        })),
        reqMap,
      ),
    ),
  ]

  // ── Aggregate entity-level counts ─────────────────────────────────────────
  const entityCounts: Record<DocumentStatus, number> = {
    Vigente: 0,
    Seguimiento: 0,
    Alerta: 0,
    Crítico: 0,
  }
  for (const e of entities) entityCounts[e.overall]++

  // ── Attention list: Crítico or Alerta, sorted severity desc then name asc ─
  const needsAttention = entities
    .filter((e) => e.overall === 'Crítico' || e.overall === 'Alerta')
    .sort((a, b) => {
      const diff = STATUS_SEVERITY[b.overall] - STATUS_SEVERITY[a.overall]
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })

  return {
    entities,
    entityCounts,
    needsAttention,
    totalEntities: entities.length,
    lastComputedAt: now.toISOString(),
  }
}

// ── Internal types ────────────────────────────────────────────────────────

interface RawDriverEvent {
  driver_id: string
  requirement_id: string
  expiry_date: string | null
  computed_status: string
  recorded_at: string
}

interface RawVehicleEvent {
  vehicle_id: string
  requirement_id: string
  expiry_date: string | null
  computed_status: string
  recorded_at: string
}

interface RawRequirement {
  id: string
  name: string
  has_expiry: boolean
  effective_from: string
  effective_to: string | null
}

// ── Per-entity summary builder ────────────────────────────────────────────

function buildEntitySummary(
  id: string,
  name: string,
  entityType: 'driver' | 'vehicle',
  events: { requirement_id: string; expiry_date: string | null }[],
  reqMap: Map<string, { name: string; has_expiry: boolean }>,
): EntityComplianceSummary {
  const counts: Record<DocumentStatus, number> = {
    Vigente: 0,
    Seguimiento: 0,
    Alerta: 0,
    Crítico: 0,
  }
  const urgentDocs: string[] = []
  const seen = new Set<string>()

  // Events arrive pre-sorted desc by recorded_at — first occurrence per
  // requirement_id is the most recent (DISTINCT ON replication).
  // Recompute status from source truth rather than using the stored value,
  // so logic fixes apply to historical events automatically.
  for (const ev of events) {
    if (seen.has(ev.requirement_id)) continue
    const req = reqMap.get(ev.requirement_id)
    if (!req) continue
    seen.add(ev.requirement_id)

    const status = computeStatus(ev.expiry_date, req.has_expiry)
    counts[status]++

    if (status === 'Crítico' || status === 'Alerta') {
      urgentDocs.push(req.name)
    }
  }

  const allStatuses = (Object.entries(counts) as [DocumentStatus, number][]).flatMap(
    ([s, n]) => Array<DocumentStatus>(n).fill(s),
  )

  const missingCount = reqMap.size - seen.size

  return {
    id,
    name,
    entity_type: entityType,
    href: entityType === 'driver' ? `/buses/drivers/${id}` : `/buses/vehicles/${id}`,
    overall: worstStatus(allStatuses),
    counts,
    urgentDocs,
    missingCount,
  }
}
