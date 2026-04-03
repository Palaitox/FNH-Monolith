'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import { revalidatePath } from 'next/cache'
import { getDriverCompliance, getVehicleCompliance } from '@/app/buses/lib/compliance-checker'
import { buildGA_F_094_Report } from '@/app/buses/lib/report-builder'
import { computeStatus } from '@/app/buses/lib/expiry-calculator'
import { getFleetCompliance } from '@/app/buses/lib/fleet-compliance'
import { sendDocumentAlert } from '@/app/(shared)/lib/notifications'
import type {
  Driver,
  Vehicle,
  VerificationPair,
  VerificationPairWithEntities,
  DocumentRequirement,
  ComplianceResult,
  FleetComplianceSummary,
  GA_F_094_Report,
  RecordDocumentInput,
} from '@/app/buses/types'

// ── Drivers ────────────────────────────────────────────────────────────────

export async function listDrivers(): Promise<Driver[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .is('deactivated_at', null)
    .order('full_name', { ascending: true })
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function listAllDrivers(): Promise<Driver[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function getDriverById(id: string): Promise<Driver | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function createDriverAction(input: {
  full_name: string
  cedula: string
}): Promise<Driver> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('drivers')
    .insert({ full_name: input.full_name, cedula: input.cedula })
    .select()
    .single()
  if (error) throw error
  revalidatePath('/buses/drivers')
  return data
}

export async function deactivateDriverAction(id: string): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const { error } = await supabase
    .from('drivers')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/buses/drivers')
}

export async function deleteDriverAction(id: string): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()

  // Delete dependents first to satisfy FK constraints
  const [evErr, pairErr] = await Promise.all([
    supabase.from('driver_document_events').delete().eq('driver_id', id).then(r => r.error),
    supabase.from('verification_pairs').delete().eq('driver_id', id).then(r => r.error),
  ])
  if (evErr) throw evErr
  if (pairErr) throw pairErr

  const { error } = await supabase.from('drivers').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/buses/drivers')
}

// ── Vehicles ───────────────────────────────────────────────────────────────

export async function listVehicles(): Promise<Vehicle[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .is('deactivated_at', null)
    .order('plate', { ascending: true })
  if (error) { console.error(error); return [] }
  return data ?? []
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function createVehicleAction(input: {
  plate: string
  type: 'titular' | 'reemplazo'
}): Promise<Vehicle> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vehicles')
    .insert({ plate: input.plate.toUpperCase(), type: input.type })
    .select()
    .single()
  if (error) throw error
  revalidatePath('/buses/vehicles')
  return data
}

export async function deactivateVehicleAction(id: string): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const { error } = await supabase
    .from('vehicles')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  revalidatePath('/buses/vehicles')
}

// ── Verification pairs ─────────────────────────────────────────────────────

export async function listVerificationPairs(): Promise<VerificationPairWithEntities[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('verification_pairs')
    .select('*, vehicles(plate, type), drivers(full_name, cedula)')
    .is('deactivated_at', null)
    .order('verified_at', { ascending: false })
  if (error) { console.error(error); return [] }
  return (data ?? []) as unknown as VerificationPairWithEntities[]
}

export async function getVerificationPair(
  id: string,
): Promise<VerificationPairWithEntities | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('verification_pairs')
    .select('*, vehicles(plate, type), drivers(full_name, cedula)')
    .eq('id', id)
    .single()
  if (error) { console.error(error); return null }
  return data as unknown as VerificationPairWithEntities
}

export async function createVerificationPairAction(input: {
  vehicle_id: string
  driver_id: string
  verified_at: string
}): Promise<VerificationPair> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('verification_pairs')
    .insert({
      vehicle_id: input.vehicle_id,
      driver_id: input.driver_id,
      verified_at: input.verified_at,
      verified_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  revalidatePath('/buses/verification')
  return data
}

// ── Document requirements ──────────────────────────────────────────────────

export async function listDocumentRequirements(
  category?: 'driver' | 'vehicle',
): Promise<DocumentRequirement[]> {
  const supabase = await createClient()
  let query = supabase
    .from('document_requirements')
    .select('*')
    .order('name', { ascending: true })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) { console.error(error); return [] }
  return data ?? []
}

// ── Document event recording ───────────────────────────────────────────────

export async function recordDriverDocumentsAction(
  driverId: string,
  documents: RecordDocumentInput[],
): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date()

  // Fetch previous statuses for transition detection
  const previousStatuses = await getPreviousDriverStatuses(supabase, driverId)

  const rows = documents.map((doc) => {
    const computed_status = computeStatus(doc.expiry_date, doc.has_expiry, today)
    const previous_status = previousStatuses.get(doc.requirement_id) ?? null
    return {
      driver_id: driverId,
      requirement_id: doc.requirement_id,
      expiry_date: doc.expiry_date,
      is_illegible: doc.is_illegible,
      computed_status,
      previous_status,
      recorded_by: user?.id ?? null,
    }
  })

  const { error } = await supabase.from('driver_document_events').insert(rows)
  if (error) throw error

  // Notify for any document that just transitioned into Crítico
  const newCritico = rows.filter(
    (r) => r.computed_status === 'Crítico' && r.previous_status !== 'Crítico',
  )
  if (newCritico.length > 0) {
    const [driverRes, reqRes] = await Promise.all([
      supabase.from('drivers').select('full_name').eq('id', driverId).single(),
      supabase.from('document_requirements')
        .select('id, name')
        .in('id', newCritico.map((r) => r.requirement_id)),
    ])
    const driverName = driverRes.data?.full_name ?? driverId
    const reqNames = new Map((reqRes.data ?? []).map((r) => [r.id, r.name]))
    const results = await Promise.all(
      newCritico.map((r) =>
        sendDocumentAlert({
          entityType: 'driver',
          entityName: driverName,
          requirementName: reqNames.get(r.requirement_id) ?? r.requirement_id,
          newStatus: 'Crítico',
          expiryDate: r.expiry_date,
        }),
      ),
    )
    results.forEach((res, i) => {
      if (res.status === 'failed') {
        console.error(`[notify] driver alert failed for req ${newCritico[i].requirement_id}:`, res.error)
      } else {
        console.log(`[notify] driver alert sent for req ${newCritico[i].requirement_id}`)
      }
    })
  }

  revalidatePath(`/buses/drivers/${driverId}`)
}

export async function recordVehicleDocumentsAction(
  vehicleId: string,
  documents: RecordDocumentInput[],
): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date()
  const previousStatuses = await getPreviousVehicleStatuses(supabase, vehicleId)

  const rows = documents.map((doc) => {
    const computed_status = computeStatus(doc.expiry_date, doc.has_expiry, today)
    const previous_status = previousStatuses.get(doc.requirement_id) ?? null
    return {
      vehicle_id: vehicleId,
      requirement_id: doc.requirement_id,
      expiry_date: doc.expiry_date,
      is_illegible: doc.is_illegible,
      computed_status,
      previous_status,
      recorded_by: user?.id ?? null,
    }
  })

  const { error } = await supabase.from('vehicle_document_events').insert(rows)
  if (error) throw error

  console.log('[notify] vehicle rows:', JSON.stringify(rows.map(r => ({
    req: r.requirement_id,
    computed: r.computed_status,
    prev: r.previous_status,
    expiry: r.expiry_date,
  }))))

  const newCritico = rows.filter(
    (r) => r.computed_status === 'Crítico' && r.previous_status !== 'Crítico',
  )
  if (newCritico.length > 0) {
    const [vehicleRes, reqRes] = await Promise.all([
      supabase.from('vehicles').select('plate').eq('id', vehicleId).single(),
      supabase.from('document_requirements')
        .select('id, name')
        .in('id', newCritico.map((r) => r.requirement_id)),
    ])
    const vehiclePlate = vehicleRes.data?.plate ?? vehicleId
    const reqNames = new Map((reqRes.data ?? []).map((r) => [r.id, r.name]))
    const results = await Promise.all(
      newCritico.map((r) =>
        sendDocumentAlert({
          entityType: 'vehicle',
          entityName: vehiclePlate,
          requirementName: reqNames.get(r.requirement_id) ?? r.requirement_id,
          newStatus: 'Crítico',
          expiryDate: r.expiry_date,
        }),
      ),
    )
    results.forEach((res, i) => {
      if (res.status === 'failed') {
        console.error(`[notify] vehicle alert failed for req ${newCritico[i].requirement_id}:`, res.error)
      } else {
        console.log(`[notify] vehicle alert sent for req ${newCritico[i].requirement_id}`)
      }
    })
  }

  revalidatePath(`/buses/vehicles/${vehicleId}`)
}

// ── Compliance ─────────────────────────────────────────────────────────────

export async function getDriverComplianceAction(
  driverId: string,
): Promise<ComplianceResult> {
  const supabase = await createClient()
  return getDriverCompliance(supabase, driverId)
}

export async function getVehicleComplianceAction(
  vehicleId: string,
): Promise<ComplianceResult> {
  const supabase = await createClient()
  return getVehicleCompliance(supabase, vehicleId)
}

export async function getFleetComplianceAction(): Promise<FleetComplianceSummary> {
  const supabase = await createClient()
  return getFleetCompliance(supabase)
}

// ── GA-F-094 Report ────────────────────────────────────────────────────────

export async function generateReportAction(
  pairId: string,
): Promise<GA_F_094_Report | null> {
  const supabase = await createClient()
  return buildGA_F_094_Report(supabase, pairId)
}

// ── Private helpers ────────────────────────────────────────────────────────

async function getPreviousDriverStatuses(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  driverId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('driver_document_events')
    .select('requirement_id, computed_status, recorded_at')
    .eq('driver_id', driverId)
    .order('recorded_at', { ascending: false })

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (!map.has(row.requirement_id)) {
      map.set(row.requirement_id, row.computed_status)
    }
  }
  return map
}

async function getPreviousVehicleStatuses(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  vehicleId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('vehicle_document_events')
    .select('requirement_id, computed_status, recorded_at')
    .eq('vehicle_id', vehicleId)
    .order('recorded_at', { ascending: false })

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (!map.has(row.requirement_id)) {
      map.set(row.requirement_id, row.computed_status)
    }
  }
  return map
}
