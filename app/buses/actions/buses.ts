'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import { revalidatePath } from 'next/cache'
import { getDriverCompliance, getVehicleCompliance } from '@/app/buses/lib/compliance-checker'
import { buildGA_F_094_Report } from '@/app/buses/lib/report-builder'
import { computeStatus } from '@/app/buses/lib/expiry-calculator'
import type {
  Driver,
  Vehicle,
  VerificationPair,
  VerificationPairWithEntities,
  DocumentRequirement,
  ComplianceResult,
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
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error(error); return null }
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
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) { console.error(error); return null }
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
    const computed_status = computeStatus(doc.expiry_date, today)
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
    const computed_status = computeStatus(doc.expiry_date, today)
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
