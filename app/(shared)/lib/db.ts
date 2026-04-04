/**
 * db.ts — typed Supabase query layer (ported from contratos/js/db.js)
 *
 * All functions accept a Supabase client as their first argument so they
 * work in any context: Server Actions (server client), Client Components
 * (browser client), and cron routes (service client).
 *
 * Import the appropriate client factory and pass it in:
 *   Server Components / Actions: createClient() from '@/lib/server'
 *   Client Components:           createClient() from '@/lib/client'
 *   Cron / admin:                createSupabaseServiceClient() from '@/app/(shared)/lib/auth'
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import type {
  Contract,
  ContractWithEmployee,
  ContractAuditLog,
  AppSettings,
} from '@/app/contracts/types'

// ── Employees ──────────────────────────────────────────────────────────────

export async function getEmployees(supabase: SupabaseClient): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .is('deactivated_at', null)
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching employees:', error)
    return []
  }
  return data ?? []
}

export async function getAllEmployees(supabase: SupabaseClient): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('full_name', { ascending: true })

  if (error) {
    console.error('Error fetching all employees:', error)
    return []
  }
  return data ?? []
}

export async function getEmployeeContracts(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<ContractWithEmployee[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      'id, employee_id, template_id, contract_number, tipo_contrato, fecha_inicio, ' +
      'fecha_terminacion, forma_pago, estado, pdf_hash, pdf_filename, pdf_path, ' +
      'docx_path, generated_at, signed_at, employees(full_name)',
    )
    .eq('employee_id', employeeId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Error fetching employee contracts:', error)
    return []
  }
  return (data ?? []) as unknown as ContractWithEmployee[]
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
    console.error('Error fetching employee:', error)
    return null
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

  // PGRST116 = no rows found — not an error condition
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching employee by cedula:', error)
  }
  return data ?? null
}

export async function upsertEmployee(
  supabase: SupabaseClient,
  emp: Omit<Employee, 'id' | 'created_at'>,
): Promise<Employee> {
  const payload = {
    full_name: emp.full_name,
    cedula: String(emp.cedula),
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

  if (error) {
    console.error('Error upserting employee:', error)
    throw error
  }
  return data
}

export async function bulkUpsertEmployees(
  supabase: SupabaseClient,
  employees: Omit<Employee, 'id' | 'created_at' | 'deactivated_at'>[],
): Promise<{ created: number; updated: number }> {
  if (employees.length === 0) return { created: 0, updated: 0 }

  const cedulas = employees.map((e) => String(e.cedula))

  // 1 query: find which cedulas already exist
  const { data: existing } = await supabase
    .from('employees')
    .select('cedula')
    .in('cedula', cedulas)

  const existingSet = new Set((existing ?? []).map((r: { cedula: string }) => r.cedula))
  const created = employees.filter((e) => !existingSet.has(String(e.cedula))).length
  const updated = employees.length - created

  // 1 query: bulk upsert all rows at once
  const payload = employees.map((emp) => ({
    full_name: emp.full_name,
    cedula: String(emp.cedula),
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

// ── Contracts ──────────────────────────────────────────────────────────────

export async function getContracts(
  supabase: SupabaseClient,
): Promise<ContractWithEmployee[]> {
  const { data, error } = await supabase
    .from('contracts')
    .select(
      'id, employee_id, template_id, contract_number, tipo_contrato, fecha_inicio, ' +
      'fecha_terminacion, forma_pago, estado, pdf_hash, pdf_filename, pdf_path, ' +
      'docx_path, generated_at, signed_at, employees(full_name)',
    )
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Error fetching contracts:', error)
    return []
  }
  return (data ?? []) as unknown as ContractWithEmployee[]
}

export async function getContract(
  supabase: SupabaseClient,
  id: string,
): Promise<ContractWithEmployee | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*, employees(full_name)')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = no rows — valid after deletion, not a real error
    if (error.code !== 'PGRST116') {
      console.error('Error fetching contract:', error)
    }
    return null
  }
  return data as ContractWithEmployee
}

export async function createContract(
  supabase: SupabaseClient,
  input: {
    employee_id: string
    contract_number: string
    tipo_contrato: string
    fecha_inicio: string
    fecha_terminacion?: string
    forma_pago?: string
  },
): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      employee_id: input.employee_id,
      contract_number: input.contract_number,
      tipo_contrato: input.tipo_contrato,
      fecha_inicio: input.fecha_inicio,
      fecha_terminacion: input.fecha_terminacion ?? null,
      forma_pago: input.forma_pago ?? null,
      estado: 'generated',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating contract:', error)
    throw error
  }
  return data
}

export async function attachSignedPdf(
  supabase: SupabaseClient,
  contractId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
): Promise<void> {
  const signedAt = new Date().toISOString()

  const { error } = await supabase
    .from('contracts')
    .update({
      pdf_path: pdfPath,
      pdf_hash: pdfHash,
      pdf_filename: filename,
      estado: 'signed',
      signed_at: signedAt,
    })
    .eq('id', contractId)

  if (error) {
    console.error('Error attaching signed PDF:', error)
    throw error
  }

  // Operational audit log (cascade-deleted with contract)
  await logContractAction(supabase, contractId, 'signed', { filename, hash: pdfHash })

  // Permanent forense record in system_logs — no FK, survives contract deletion
  const { data: contract } = await supabase
    .from('contracts')
    .select('contract_number, employee_id, employees(full_name)')
    .eq('id', contractId)
    .single()
  const { data: { user } } = await supabase.auth.getUser()
  // employees is returned as an array by the Supabase join
  const employeesArr = (contract as unknown as { employees: { full_name: string }[] } | null)?.employees
  const employeeName = Array.isArray(employeesArr) ? (employeesArr[0]?.full_name ?? null) : null
  await supabase.from('system_logs').insert({
    log_type: 'server_action',
    payload: {
      event: 'contract_signed',
      contract_id: contractId,
      contract_number: (contract as { contract_number: string | null } | null)?.contract_number ?? null,
      employee_name: employeeName,
      pdf_filename: filename,
      pdf_hash: pdfHash,
      signed_at: signedAt,
      signed_by_email: user?.email ?? null,
      signed_by_id: user?.id ?? null,
    },
  })
}

export async function deleteContract(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) {
    console.error('Error deleting contract:', error)
    throw error
  }
}

// ── Contract number ────────────────────────────────────────────────────────

export async function peekNextContractNumber(
  supabase: SupabaseClient,
): Promise<string> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from('contracts')
    .select('contract_number')
    .like('contract_number', `${year}-%`)

  let max = 0
  if (data && data.length > 0) {
    const numbers = (data as { contract_number: string | null }[]).map((c) => {
      const parts = (c.contract_number ?? '').split('-')
      return parts.length > 1 ? parseInt(parts[1]) || 0 : 0
    })
    max = Math.max(...numbers)
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`
}

// ── Audit log ──────────────────────────────────────────────────────────────

export async function getContractAuditLogs(
  supabase: SupabaseClient,
  contractId: string,
): Promise<ContractAuditLog[]> {
  const { data, error } = await supabase
    .from('contract_audit_logs')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching audit logs:', error)
    return []
  }
  return data ?? []
}

export async function logContractAction(
  supabase: SupabaseClient,
  contractId: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.from('contract_audit_logs').insert({
    contract_id: contractId,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    action,
    details,
  })
}

// ── Settings / Config ──────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: AppSettings = {
  lugarTrabajo: 'CENTRO VIDA/DIA MUNICIPAL',
  formaPago: 'MENSUAL LOS CINCO PRIMEROS DIAS DE CADA MES',
  empleadorNombre: 'FUNDACION NUEVO HORIZONTE',
  empleadorNit: '821.003.251-4',
  empleadorRepresentante: 'REPRESENTANTE LEGAL',
}

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('key', 'app_settings')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching settings:', error)
  }
  return { ...SETTINGS_DEFAULTS, ...(data?.value ?? {}) }
}

export async function saveSettings(
  supabase: SupabaseClient,
  settings: AppSettings,
): Promise<void> {
  const { error } = await supabase
    .from('config')
    .upsert({ key: 'app_settings', value: settings })
  if (error) console.error('Error saving settings:', error)
}

// ── Stats ──────────────────────────────────────────────────────────────────

export async function getStats(supabase: SupabaseClient) {
  const [employees, contracts] = await Promise.all([
    getEmployees(supabase),
    getContracts(supabase),
  ])
  const now = new Date()
  const contractsThisMonth = contracts.filter((c) => {
    const d = new Date(c.generated_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  return {
    totalEmployees: employees.length,
    totalContracts: contracts.length,
    contractsThisMonth: contractsThisMonth.length,
    contractsSigned: contracts.filter((c) => c.estado === 'signed').length,
    contractsPending: contracts.filter((c) => c.estado === 'generated').length,
  }
}

export async function getRecentContracts(
  supabase: SupabaseClient,
  limit = 10,
): Promise<ContractWithEmployee[]> {
  const all = await getContracts(supabase)
  return all.slice(0, limit)
}
