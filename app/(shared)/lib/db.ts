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
import type { Employee, EmployeeLeave, LeaveType } from '@/app/(shared)/lib/employee-types'
import type {
  ContractCase,
  ContractDocument,
  ContractDocumentFull,
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
): Promise<ContractDocumentFull[]> {
  // Two-step: get case IDs for this employee, then fetch their documents
  const { data: cases } = await supabase
    .from('contract_cases')
    .select('id')
    .eq('employee_id', employeeId)

  if (!cases || cases.length === 0) return []

  const caseIds = cases.map((c: { id: string }) => c.id)

  const { data, error } = await supabase
    .from('contract_documents')
    .select(DOCUMENT_SELECT)
    .in('case_id', caseIds)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Error fetching employee contracts:', error)
    return []
  }
  return (data ?? []) as unknown as ContractDocumentFull[]
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

// ── Contract Cases ──────────────────────────────────────────────────────────

export async function getCasesByEmployee(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<ContractCase[]> {
  const { data, error } = await supabase
    .from('contract_cases')
    .select('id, employee_id, case_number, status, current_end_date, created_at')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching cases:', error)
    return []
  }
  return (data ?? []) as ContractCase[]
}

// ── Contract Documents ───────────────────────────────────────────────────────

const DOCUMENT_SELECT = `
  id, case_id, document_type, tipo_contrato, fecha_inicio, fecha_terminacion,
  forma_pago, affects_term, estado, pdf_hash, pdf_filename, pdf_path,
  generated_at, signed_at,
  contract_cases(id, case_number, status, current_end_date, created_at, employee_id,
    employees(full_name)
  )
`.trim()

export async function getDocuments(
  supabase: SupabaseClient,
): Promise<ContractDocumentFull[]> {
  const { data, error } = await supabase
    .from('contract_documents')
    .select(DOCUMENT_SELECT)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }
  return (data ?? []) as unknown as ContractDocumentFull[]
}

export async function getDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<ContractDocumentFull | null> {
  const { data, error } = await supabase
    .from('contract_documents')
    .select(DOCUMENT_SELECT)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('Error fetching document:', error)
    }
    return null
  }
  return data as unknown as ContractDocumentFull
}

export async function createCase(
  supabase: SupabaseClient,
  input: { employee_id: string },
): Promise<ContractCase> {
  // Claim the next sequential number atomically from the config counter
  const { data: caseNumber, error: numErr } = await supabase.rpc('claim_next_case_number')
  if (numErr) {
    console.error('Error claiming case number:', numErr)
    throw numErr
  }

  const { data, error } = await supabase
    .from('contract_cases')
    .insert({ employee_id: input.employee_id, case_number: caseNumber as string })
    .select()
    .single()

  if (error) {
    console.error('Error creating contract case:', error)
    throw error
  }
  return data as ContractCase
}

export async function createDocument(
  supabase: SupabaseClient,
  input: {
    case_id: string
    document_type: string
    tipo_contrato?: string
    fecha_inicio: string
    fecha_terminacion?: string
    forma_pago?: string
    affects_term?: boolean
  },
): Promise<ContractDocument> {
  const { data, error } = await supabase
    .from('contract_documents')
    .insert({
      case_id: input.case_id,
      document_type: input.document_type,
      tipo_contrato: input.tipo_contrato ?? null,
      fecha_inicio: input.fecha_inicio,
      fecha_terminacion: input.fecha_terminacion ?? null,
      forma_pago: input.forma_pago ?? null,
      affects_term: input.affects_term ?? false,
      estado: 'generated',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating contract document:', error)
    throw error
  }
  return data as ContractDocument
}

export async function attachSignedPdf(
  supabase: SupabaseClient,
  documentId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
): Promise<void> {
  const signedAt = new Date().toISOString()

  const { error } = await supabase
    .from('contract_documents')
    .update({
      pdf_path: pdfPath,
      pdf_hash: pdfHash,
      pdf_filename: filename,
      estado: 'signed',
      signed_at: signedAt,
    })
    .eq('id', documentId)

  if (error) {
    console.error('Error attaching signed PDF:', error)
    throw error
  }

  // Operational audit log (cascade-deleted with document)
  await logDocumentAction(supabase, documentId, 'signed', { filename, hash: pdfHash })

  // Permanent forense record in system_logs — no FK, survives document deletion
  const { data: doc } = await supabase
    .from('contract_documents')
    .select('contract_cases(case_number, employees(full_name))')
    .eq('id', documentId)
    .single()
  const { data: { user } } = await supabase.auth.getUser()
  const caseData = (doc as unknown as {
    contract_cases: { case_number: string; employees: { full_name: string }[] }
  } | null)?.contract_cases
  const employeeName = Array.isArray(caseData?.employees)
    ? (caseData.employees[0]?.full_name ?? null) : null
  await supabase.from('system_logs').insert({
    log_type: 'server_action',
    payload: {
      event: 'contract_signed',
      document_id: documentId,
      case_number: caseData?.case_number ?? null,
      employee_name: employeeName,
      pdf_filename: filename,
      pdf_hash: pdfHash,
      signed_at: signedAt,
      signed_by_email: user?.email ?? null,
      signed_by_id: user?.id ?? null,
    },
  })
}

export async function deleteDocument(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from('contract_documents').delete().eq('id', id)
  if (error) {
    console.error('Error deleting document:', error)
    throw error
  }
}

// ── Case number ───────────────────────────────────────────────────────────────
//
// The counter lives in config { key: 'case_counter', value: { year, next } }.
// Two SECURITY DEFINER RPCs manage it:
//   peek_next_case_number()  — read-only, for UI display
//   claim_next_case_number() — atomically increments and returns the assigned number
//
// Deleting records never affects numbering (ND-46).

export async function peekNextCaseNumber(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.rpc('peek_next_case_number')
  if (error) {
    console.error('Error peeking case number:', error)
    return `${new Date().getFullYear()}-???`
  }
  return data as string
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function getDocumentAuditLogs(
  supabase: SupabaseClient,
  documentId: string,
): Promise<ContractAuditLog[]> {
  const { data, error } = await supabase
    .from('contract_audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching audit logs:', error)
    return []
  }
  return data ?? []
}

export async function logDocumentAction(
  supabase: SupabaseClient,
  documentId: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('contract_audit_logs').insert({
    document_id: documentId,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    action,
    details,
  })
}

// ── Settings / Config ──────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: AppSettings = {
  lugarTrabajo: 'CENTRO VIDA/DIA MUNICIPAL',
  formaPago: 'MENSUAL ENTRE EL DÍA QUINCE (15) Y EL DÍA VEINTE (20) DE CADA MES',
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
  const [employees, documents] = await Promise.all([
    getEmployees(supabase),
    getDocuments(supabase),
  ])
  const now = new Date()
  const contractsThisMonth = documents.filter((d) => {
    const dt = new Date(d.generated_at)
    return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
  })
  return {
    totalEmployees: employees.length,
    totalContracts: documents.length,
    contractsThisMonth: contractsThisMonth.length,
    contractsSigned: documents.filter((d) => d.estado === 'signed').length,
    contractsPending: documents.filter((d) => d.estado === 'generated').length,
  }
}

export async function getRecentDocuments(
  supabase: SupabaseClient,
  limit = 10,
): Promise<ContractDocumentFull[]> {
  const all = await getDocuments(supabase)
  return all.slice(0, limit)
}

// ── Employee Leaves ────────────────────────────────────────────────────────

/** Returns all leaves for a single employee, newest first. */
export async function getEmployeeLeaves(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<EmployeeLeave[]> {
  const { data, error } = await supabase
    .from('employee_leaves')
    .select('*')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as EmployeeLeave[]
}

/** Returns a map of employee_id → active leave for all employees currently on leave. */
export async function getActiveLeavesMap(
  supabase: SupabaseClient,
): Promise<Map<string, EmployeeLeave>> {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('employee_leaves')
    .select('*')
    .lte('start_date', today)
    .or(`actual_end_date.is.null,actual_end_date.gt.${today}`)
  if (error) throw error
  const map = new Map<string, EmployeeLeave>()
  for (const leave of (data ?? []) as EmployeeLeave[]) {
    if (!map.has(leave.employee_id)) map.set(leave.employee_id, leave)
  }
  return map
}

/** Opens a new leave record. */
export async function createLeave(
  supabase: SupabaseClient,
  input: {
    employee_id: string
    leave_type: LeaveType
    start_date: string
    expected_end_date?: string | null
    notes?: string | null
  },
): Promise<EmployeeLeave> {
  const { data, error } = await supabase
    .from('employee_leaves')
    .insert({
      employee_id:       input.employee_id,
      leave_type:        input.leave_type,
      start_date:        input.start_date,
      expected_end_date: input.expected_end_date ?? null,
      notes:             input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as EmployeeLeave
}

/** Closes an active leave by setting actual_end_date. */
export async function closeLeave(
  supabase: SupabaseClient,
  leaveId: string,
  actualEndDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('employee_leaves')
    .update({ actual_end_date: actualEndDate })
    .eq('id', leaveId)
  if (error) throw error
}
