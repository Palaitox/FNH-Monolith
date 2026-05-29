import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContractCase,
  ContractDocument,
  ContractDocumentFull,
  ContractAuditLog,
} from '@/app/contracts/types'
import { getEmployees } from './employees'

// ── Document select fragment ───────────────────────────────────────────────
// Exported so employees.ts (getEmployeeContracts) can reuse it without
// creating a circular dep through the index.

export const DOCUMENT_SELECT = `
  id, case_id, document_type, tipo_contrato, fecha_inicio, fecha_terminacion,
  forma_pago, affects_term, estado, pdf_hash, pdf_filename, pdf_path,
  generated_at, signed_at, firma_trabajador, firma_representante,
  contract_cases(id, case_number, status, current_end_date, created_at, employee_id,
    employees(full_name)
  )
`.trim()

// ── Cases ──────────────────────────────────────────────────────────────────

export async function getCasesByEmployee(
  supabase: SupabaseClient,
  employeeId: string,
): Promise<ContractCase[]> {
  const { data, error } = await supabase
    .from('contract_cases')
    .select('id, employee_id, case_number, status, current_end_date, created_at')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContractCase[]
}

// ── Documents ─────────────────────────────────────────────────────────────

export async function getDocuments(supabase: SupabaseClient): Promise<ContractDocumentFull[]> {
  const { data, error } = await supabase
    .from('contract_documents')
    .select(DOCUMENT_SELECT)
    .order('generated_at', { ascending: false })
  if (error) throw error
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
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as unknown as ContractDocumentFull
}

export async function createCase(
  supabase: SupabaseClient,
  input: { employee_id: string },
): Promise<ContractCase> {
  const { data: caseNumber, error: numErr } = await supabase.rpc('claim_next_case_number')
  if (numErr) throw numErr

  const { data, error } = await supabase
    .from('contract_cases')
    .insert({ employee_id: input.employee_id, case_number: caseNumber as string })
    .select()
    .single()
  if (error) throw error
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
  if (error) throw error
  return data as ContractDocument
}

export async function attachSignedPdf(
  supabase: SupabaseClient,
  documentId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
  firmaTrabajador?: string,
  metadata?: { ip: string; userAgent: string },
  workerVerification?: { userId: string; email: string },
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
      ...(firmaTrabajador !== undefined ? { firma_trabajador: firmaTrabajador } : {}),
    })
    .eq('id', documentId)
  if (error) throw error

  await logDocumentAction(supabase, documentId, 'signed', { filename, hash: pdfHash })

  // Permanent forense record — no FK, survives document deletion
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
      client_ip: metadata?.ip ?? null,
      client_user_agent: metadata?.userAgent ?? null,
      worker_verified: workerVerification != null,
      worker_user_id: workerVerification?.userId ?? null,
      worker_email: workerVerification?.email ?? null,
    },
  })
}

export async function attachRepresentativeSignature(
  supabase: SupabaseClient,
  documentId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
  firmaRepresentante: string,
  metadata?: { ip: string; userAgent: string },
): Promise<void> {
  const signedAt = new Date().toISOString()

  const { error } = await supabase
    .from('contract_documents')
    .update({
      pdf_path: pdfPath,
      pdf_hash: pdfHash,
      pdf_filename: filename,
      firma_representante: firmaRepresentante,
    })
    .eq('id', documentId)
  if (error) throw error

  await logDocumentAction(supabase, documentId, 'representative_signed', { filename, hash: pdfHash })

  // Permanent forense record — mirrors contract_signed entry for the worker signature
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
      event: 'contract_representative_signed',
      document_id: documentId,
      case_number: caseData?.case_number ?? null,
      employee_name: employeeName,
      pdf_filename: filename,
      pdf_hash: pdfHash,
      signed_at: signedAt,
      signed_by_email: user?.email ?? null,
      signed_by_id: user?.id ?? null,
      client_ip: metadata?.ip ?? null,
      client_user_agent: metadata?.userAgent ?? null,
    },
  })
}

export async function deleteDocument(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('contract_documents').delete().eq('id', id)
  if (error) throw error
}

// ── Case number ───────────────────────────────────────────────────────────
//
// peek_next_case_number() is read-only (display). claim_next_case_number()
// atomically increments. Deleting records never affects numbering (ND-46).

export async function peekNextCaseNumber(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc('peek_next_case_number')
  if (error) return `${new Date().getFullYear()}-???`
  return data as string
}

// ── Audit log ─────────────────────────────────────────────────────────────

export async function getDocumentAuditLogs(
  supabase: SupabaseClient,
  documentId: string,
): Promise<ContractAuditLog[]> {
  const { data, error } = await supabase
    .from('contract_audit_logs')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw error
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
  const pendingRepSignature = documents
    .filter((d) => !!d.firma_trabajador && !d.firma_representante && d.estado === 'signed')
    .map((d) => ({
      id: d.id,
      employeeName: d.contract_cases?.employees?.full_name ?? '—',
      caseNumber: d.contract_cases?.case_number ?? '—',
    }))

  return {
    totalEmployees: employees.length,
    totalContracts: documents.length,
    contractsThisMonth: contractsThisMonth.length,
    contractsSigned: documents.filter((d) => d.estado === 'signed').length,
    contractsPending: documents.filter((d) => d.estado === 'generated').length,
    pendingRepSignature,
  }
}

