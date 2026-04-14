'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import {
  getDocuments,
  getDocument,
  createCase,
  createDocument,
  deleteDocument,
  getEmployees,
  getEmployee,
  peekNextCaseNumber,  // used by nextContractNumber() for form display
  getCasesByEmployee,
  attachSignedPdf,
  getStats,
  getSettings,
} from '@/app/(shared)/lib/db'
import type {
  ContractCase,
  ContractDocumentFull,
  AppSettings,
} from '@/app/contracts/types'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Read ───────────────────────────────────────────────────────────────────

export async function listContracts(): Promise<ContractDocumentFull[]> {
  const supabase = await createClient()
  return getDocuments(supabase)
}

export async function getContractById(id: string) {
  const supabase = await createClient()
  return getDocument(supabase, id)
}

export async function listEmployees(): Promise<Employee[]> {
  const supabase = await createClient()
  return getEmployees(supabase)
}

export async function getEmployeeById(id: string) {
  const supabase = await createClient()
  return getEmployee(supabase, id)
}

export async function nextContractNumber(): Promise<string> {
  const supabase = await createClient()
  return peekNextCaseNumber(supabase)
}

export async function getCasesForEmployee(employeeId: string): Promise<ContractCase[]> {
  const supabase = await createClient()
  return getCasesByEmployee(supabase, employeeId)
}

export async function getDashboardStats() {
  const supabase = await createClient()
  return getStats(supabase)
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient()
  return getSettings(supabase)
}

export interface EmployeeContractStatus {
  id: string
  full_name: string
  daysLeft: number | null
  caseNumber: string | null
}

export interface EmployeeContractSummary {
  sinContrato: EmployeeContractStatus[]
  pendienteFirma: EmployeeContractStatus[]
  vigentes: EmployeeContractStatus[]
}

export async function getEmployeeContractStatusAction(): Promise<EmployeeContractSummary> {
  const supabase = await createClient()
  const [employees, documents] = await Promise.all([
    getEmployees(supabase),
    getDocuments(supabase),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Group documents by employee_id
  const byEmployee = new Map<string, ContractDocumentFull[]>()
  for (const doc of documents) {
    const empId = doc.contract_cases?.employee_id
    if (!empId) continue
    if (!byEmployee.has(empId)) byEmployee.set(empId, [])
    byEmployee.get(empId)!.push(doc)
  }

  const result: EmployeeContractSummary = { sinContrato: [], pendienteFirma: [], vigentes: [] }

  for (const emp of employees) {
    const docs = byEmployee.get(emp.id) ?? []

    if (docs.length === 0) {
      result.sinContrato.push({ id: emp.id, full_name: emp.full_name, daysLeft: null, caseNumber: null })
      continue
    }

    // Group by case
    const caseMap = new Map<string, ContractDocumentFull[]>()
    for (const doc of docs) {
      if (!caseMap.has(doc.case_id)) caseMap.set(doc.case_id, [])
      caseMap.get(doc.case_id)!.push(doc)
    }

    let bestDaysLeft: number | null = null
    let bestCaseNumber: string | null = null
    let hasActiveContract = false

    for (const caseDocs of caseMap.values()) {
      const inicial = caseDocs.find((d) => d.document_type === 'INICIAL')
      const caseNumber = caseDocs[0]?.contract_cases?.case_number ?? null
      const endDate = caseDocs[0]?.contract_cases?.current_end_date ?? inicial?.fecha_terminacion ?? null
      const fechaInicio = inicial?.fecha_inicio

      if (!fechaInicio) continue
      const start = new Date(fechaInicio)
      start.setHours(0, 0, 0, 0)
      if (start > today) continue

      if (!endDate) {
        // Indefinite — always active
        hasActiveContract = true
        bestCaseNumber = caseNumber
        bestDaysLeft = null
        continue
      }

      const end = new Date(endDate)
      end.setHours(0, 0, 0, 0)
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysLeft >= 0) {
        hasActiveContract = true
        if (bestDaysLeft === null || daysLeft < bestDaysLeft) {
          bestDaysLeft = daysLeft
          bestCaseNumber = caseNumber
        }
      }
    }

    const hasPending = docs.some((d) => d.estado === 'generated')

    if (hasActiveContract) {
      result.vigentes.push({ id: emp.id, full_name: emp.full_name, daysLeft: bestDaysLeft, caseNumber: bestCaseNumber })
      if (hasPending) {
        result.pendienteFirma.push({ id: emp.id, full_name: emp.full_name, daysLeft: bestDaysLeft, caseNumber: bestCaseNumber })
      }
    } else {
      result.sinContrato.push({ id: emp.id, full_name: emp.full_name, daysLeft: null, caseNumber: null })
      if (hasPending) {
        result.pendienteFirma.push({ id: emp.id, full_name: emp.full_name, daysLeft: null, caseNumber: null })
      }
    }
  }

  // Sort each list alphabetically
  const sort = (arr: EmployeeContractStatus[]) =>
    arr.sort((a, b) => a.full_name.localeCompare(b.full_name))
  sort(result.sinContrato)
  sort(result.pendienteFirma)
  sort(result.vigentes)

  return result
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createContractAction(input: {
  employee_id: string
  document_type: string
  tipo_contrato: string
  fecha_inicio: string
  fecha_terminacion?: string
  forma_pago?: string
  /** For OTRO_SI and other amendments: the existing case to link to */
  case_id?: string
}) {
  await requireRole('coordinator')
  const supabase = await createClient()

  let caseId: string

  if (input.case_id) {
    // Amendment (OTRO_SI, PRORROGA, etc.) — add to existing case
    caseId = input.case_id
  } else {
    // New employment cycle — createCase claims the next number atomically
    const newCase = await createCase(supabase, { employee_id: input.employee_id })
    caseId = newCase.id
  }

  const doc = await createDocument(supabase, {
    case_id: caseId,
    document_type: input.document_type,
    tipo_contrato: input.document_type === 'INICIAL' ? input.tipo_contrato : undefined,
    fecha_inicio: input.fecha_inicio,
    fecha_terminacion: input.fecha_terminacion,
    forma_pago: input.forma_pago,
    affects_term: input.document_type === 'PRORROGA',
  })

  revalidatePath('/contracts')
  return doc
}

export async function deleteContractAction(id: string) {
  await requireRole('admin')
  const supabase = await createClient()

  // If the document is signed, write a permanent forense entry to system_logs
  // before the cascade delete removes all contract_audit_logs rows.
  const { data: doc } = await supabase
    .from('contract_documents')
    .select('case_id, estado, pdf_filename, pdf_hash, signed_at, contract_cases(case_number, employees(full_name))')
    .eq('id', id)
    .maybeSingle()

  if (doc?.estado === 'signed') {
    const { data: { user } } = await supabase.auth.getUser()
    const caseData = (doc as unknown as {
      case_id: string
      contract_cases: { case_number: string; employees: { full_name: string }[] }
    }).contract_cases
    const employeeName = Array.isArray(caseData?.employees)
      ? (caseData.employees[0]?.full_name ?? null) : null
    await supabase.from('system_logs').insert({
      log_type: 'server_action',
      payload: {
        event: 'signed_contract_deleted',
        document_id: id,
        case_number: caseData?.case_number ?? null,
        employee_name: employeeName,
        pdf_filename: doc.pdf_filename ?? null,
        pdf_hash: doc.pdf_hash ?? null,
        signed_at: doc.signed_at ?? null,
        deleted_by_email: user?.email ?? null,
        deleted_by_id: user?.id ?? null,
        deleted_at: new Date().toISOString(),
      },
    })
  }

  const caseId = (doc as unknown as { case_id: string } | null)?.case_id ?? null

  await deleteDocument(supabase, id)

  // If the case has no remaining documents, delete it so its number is freed
  if (caseId) {
    const { count } = await supabase
      .from('contract_documents')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)
    if ((count ?? 0) === 0) {
      await supabase.from('contract_cases').delete().eq('id', caseId)
    }
  }

  revalidatePath('/contracts')
  redirect('/contracts')
}

export async function attachSignedPdfAction(
  documentId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
) {
  await requireRole('coordinator')
  const supabase = await createClient()
  await attachSignedPdf(supabase, documentId, pdfPath, filename, pdfHash)
  revalidatePath('/contracts')
}
