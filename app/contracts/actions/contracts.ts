'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import { headers } from 'next/headers'
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
  attachRepresentativeSignature,
  getStats,
  getSettings,
  getActiveLeavesMap,
  logDocumentAction,
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

export async function getInitialContractDates(
  caseId: string,
): Promise<{ fecha_inicio: string | null; fecha_terminacion: string | null } | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contract_documents')
    .select('fecha_inicio, fecha_terminacion')
    .eq('case_id', caseId)
    .eq('document_type', 'INICIAL')
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export interface EmployeeContractStatus {
  id: string
  full_name: string
  daysLeft: number | null
  caseNumber: string | null
}

export interface EmployeeContractSummary {
  sinExpediente: EmployeeContractStatus[]  // never had any contract in the system
  sinContrato: EmployeeContractStatus[]    // had contracts but none currently active
  pendienteFirma: EmployeeContractStatus[]
  vigentes: EmployeeContractStatus[]
  enLicencia: EmployeeContractStatus[]
}

export async function getEmployeeContractStatusAction(): Promise<EmployeeContractSummary> {
  const supabase = await createClient()
  const [employees, documents, activeLeavesMap] = await Promise.all([
    getEmployees(supabase),
    getDocuments(supabase),
    getActiveLeavesMap(supabase),
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

  const result: EmployeeContractSummary = { sinExpediente: [], sinContrato: [], pendienteFirma: [], vigentes: [], enLicencia: [] }

  for (const emp of employees) {
    const docs = byEmployee.get(emp.id) ?? []

    if (docs.length === 0) {
      result.sinExpediente.push({ id: emp.id, full_name: emp.full_name, daysLeft: null, caseNumber: null })
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

    const hasPending  = docs.some((d) => d.estado === 'generated')
    const onLeave     = activeLeavesMap.has(emp.id)

    if (hasActiveContract) {
      result.vigentes.push({ id: emp.id, full_name: emp.full_name, daysLeft: bestDaysLeft, caseNumber: bestCaseNumber })
      if (hasPending) {
        result.pendienteFirma.push({ id: emp.id, full_name: emp.full_name, daysLeft: bestDaysLeft, caseNumber: bestCaseNumber })
      }
    } else if (onLeave) {
      // Employee on active leave: employment is protected even if contract appears expired
      result.enLicencia.push({ id: emp.id, full_name: emp.full_name, daysLeft: null, caseNumber: bestCaseNumber })
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
  sort(result.sinExpediente)
  sort(result.sinContrato)
  sort(result.pendienteFirma)
  sort(result.vigentes)
  sort(result.enLicencia)

  return result
}

// ── Request metadata ───────────────────────────────────────────────────────

async function getRequestMetadata() {
  const h = await headers()
  return {
    ip: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown',
    userAgent: h.get('user-agent') ?? 'unknown',
  }
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
    affects_term: input.document_type === 'PRORROGA' || input.document_type === 'OTRO_SI_AMPLIACION',
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
      const { error: caseErr } = await supabase.from('contract_cases').delete().eq('id', caseId)
      if (caseErr) throw caseErr
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
  firmaTrabajador?: string,
  workerVerification?: { userId: string; email: string },
) {
  await requireRole('coordinator')
  const supabase = await createClient()
  const meta = await getRequestMetadata()
  await attachSignedPdf(supabase, documentId, pdfPath, filename, pdfHash, firmaTrabajador, meta, workerVerification)
  revalidatePath('/contracts')
}

export async function attachRepresentativeSignatureAction(
  documentId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
  firmaRepresentante: string,
) {
  await requireRole('supervisor')
  const supabase = await createClient()
  const meta = await getRequestMetadata()
  await attachRepresentativeSignature(supabase, documentId, pdfPath, filename, pdfHash, firmaRepresentante, meta)
  revalidatePath('/contracts', 'layout')
}

export async function sendContractCopyAction(
  documentId: string,
): Promise<{ success: true; recipient: string } | { error: string }> {
  await requireRole('coordinator')
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('contract_documents')
    .select('pdf_path, pdf_filename, contract_cases(case_number, employees(full_name, correo))')
    .eq('id', documentId)
    .maybeSingle()

  if (!doc?.pdf_path) return { error: 'El contrato no tiene PDF firmado.' }

  type DocShape = {
    pdf_path: string
    pdf_filename: string | null
    contract_cases: {
      case_number: string
      employees: { full_name: string; correo: string | null }[]
    }
  }
  const d = doc as unknown as DocShape
  const employee = Array.isArray(d.contract_cases?.employees) ? d.contract_cases.employees[0] : null
  const correo = employee?.correo ?? null
  const caseNumber = d.contract_cases?.case_number ?? '—'

  if (!correo) return { error: 'El empleado no tiene correo registrado en el sistema.' }

  const { data: urlData, error: urlErr } = await supabase.storage
    .from('contracts')
    .createSignedUrl(doc.pdf_path, 60 * 60 * 24 * 7) // 7 días

  if (urlErr || !urlData?.signedUrl) return { error: 'No se pudo generar el enlace al PDF.' }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  const { error: emailErr } = await resend.emails.send({
    from: FROM,
    to: correo,
    subject: `Copia de contrato firmado — Expediente ${caseNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:0 auto">
        <h2 style="color:#111827;margin-bottom:4px">Copia de tu contrato firmado</h2>
        <p style="color:#4b5563">Hola <strong>${employee?.full_name ?? 'estimado/a'}</strong>,</p>
        <p style="color:#4b5563">
          A continuación encontrarás el enlace para descargar tu contrato firmado
          correspondiente al expediente <strong>${caseNumber}</strong>
          de la Fundación Nuevo Horizonte.
        </p>
        <p style="margin:28px 0">
          <a href="${urlData.signedUrl}"
             style="background:#111827;color:#fff;padding:11px 22px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
            Descargar contrato
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">
          El enlace estará activo por <strong>7 días</strong>. Si tienes alguna pregunta,
          comunícate con el área de recursos humanos.
        </p>
        <p style="margin-top:24px;font-size:12px;color:#9ca3af">
          Este mensaje fue generado automáticamente por el sistema de gestión FNH.
        </p>
      </div>
    `,
  })

  if (emailErr) return { error: `Error al enviar el correo: ${emailErr.message}` }

  await logDocumentAction(supabase, documentId, 'copy_sent', { recipient_email: correo })

  return { success: true, recipient: correo }
}
