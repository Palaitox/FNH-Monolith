import type { SupabaseClient } from '@supabase/supabase-js'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import type { ContractDocumentFull } from '@/app/contracts/types'
import { DOCUMENT_SELECT } from './contracts'

// ── Employees ──────────────────────────────────────────────────────────────

export async function getEmployees(supabase: SupabaseClient): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .is('deactivated_at', null)
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getAllEmployees(supabase: SupabaseClient): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getEmployee(
  supabase: SupabaseClient,
  id: string,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getEmployeeByCedula(
  supabase: SupabaseClient,
  cedula: string,
): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('cedula', String(cedula))
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function upsertEmployee(
  supabase: SupabaseClient,
  emp: Omit<Employee, 'id' | 'created_at'>,
): Promise<Employee> {
  const payload = {
    full_name: emp.full_name,
    cedula: String(emp.cedula),
    ciudad_cedula: emp.ciudad_cedula ?? null,
    cargo: emp.cargo ?? null,
    telefono: emp.telefono ?? null,
    correo: emp.correo ?? null,
    salario_base: emp.salario_base ?? null,
    auxilio_transporte: emp.auxilio_transporte ?? 0,
    jornada_laboral: emp.jornada_laboral ?? 'tiempo_completo',
  }
  const { data, error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: 'cedula' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function bulkUpsertEmployees(
  supabase: SupabaseClient,
  employees: Omit<Employee, 'id' | 'created_at' | 'deactivated_at'>[],
): Promise<{ created: number; updated: number }> {
  if (employees.length === 0) return { created: 0, updated: 0 }

  const cedulas = employees.map((e) => String(e.cedula))
  const { data: existing, error: existErr } = await supabase
    .from('employees')
    .select('cedula')
    .in('cedula', cedulas)
  if (existErr) throw existErr

  const existingSet = new Set((existing ?? []).map((r: { cedula: string }) => r.cedula))
  const created = employees.filter((e) => !existingSet.has(String(e.cedula))).length
  const updated = employees.length - created

  const payload = employees.map((emp) => ({
    full_name: emp.full_name,
    cedula: String(emp.cedula),
    ciudad_cedula: emp.ciudad_cedula ?? null,
    cargo: emp.cargo ?? null,
    telefono: emp.telefono ?? null,
    correo: emp.correo ?? null,
    salario_base: emp.salario_base ?? null,
    auxilio_transporte: emp.auxilio_transporte ?? 0,
    jornada_laboral: emp.jornada_laboral ?? 'tiempo_completo',
  }))

  const { error } = await supabase
    .from('employees')
    .upsert(payload, { onConflict: 'cedula' })
  if (error) throw error

  return { created, updated }
}

/** Returns all contract documents for a given employee across all their cases. */
export async function getEmployeeContracts(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<ContractDocumentFull[]> {
  const { data: cases, error: casesErr } = await supabase
    .from('contract_cases')
    .select('id')
    .eq('employee_id', employeeId)
  if (casesErr) throw casesErr
  if (!cases || cases.length === 0) return []

  const caseIds = cases.map((c: { id: string }) => c.id)
  const { data, error } = await supabase
    .from('contract_documents')
    .select(DOCUMENT_SELECT)
    .in('case_id', caseIds)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as ContractDocumentFull[]
}
