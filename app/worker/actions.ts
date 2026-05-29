'use server'

import { headers } from 'next/headers'
import { getUserRole, getUserClaims, createSupabaseServiceClient } from '@/app/(shared)/lib/auth'
import { createClient } from '@/lib/server'
import { logDocumentAction } from '@/app/(shared)/lib/db'

/**
 * Signs a contract on behalf of a worker.
 *
 * Authorization: caller must have role='worker' AND the contract must belong
 * to the employee linked to their user_id. All other callers are rejected.
 *
 * The PDF is uploaded server-side using the service client to avoid needing
 * storage RLS policies for the worker role.
 */
export async function workerSignContractAction(
  documentId: string,
  pdfBase64: string,
  firmaTrabajador: string,
): Promise<{ success: true; pdfPath: string } | { error: string }> {
  const role = await getUserRole()
  if (role !== 'worker') return { error: 'Unauthorized' }

  const claims = await getUserClaims()
  const userId = claims?.sub
  if (!userId) return { error: 'Unauthorized' }

  const service = await createSupabaseServiceClient()

  // Find the employee linked to this worker account
  const { data: employee } = await service
    .from('employees')
    .select('id, full_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (!employee) return { error: 'Tu cuenta no está vinculada a ningún empleado.' }

  // Verify the document belongs to this employee
  const { data: doc } = await service
    .from('contract_documents')
    .select('id, estado, case_id, pdf_path, contract_cases(case_number, employee_id)')
    .eq('id', documentId)
    .maybeSingle()

  const caseEmployeeId = (doc as unknown as {
    contract_cases: { employee_id: string; case_number: string }
  } | null)?.contract_cases?.employee_id

  if (!doc || caseEmployeeId !== employee.id) {
    return { error: 'No tienes permiso para firmar este contrato.' }
  }

  if (doc.estado !== 'generated') {
    return { error: 'Este contrato ya fue firmado.' }
  }

  const caseNumber = (doc as unknown as {
    contract_cases: { case_number: string }
  }).contract_cases?.case_number ?? 'doc'

  // Decode base64 PDF and compute SHA-256 hash
  const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))
  const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBytes)
  const pdfHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  const filename = `contrato_${caseNumber}_firmado.pdf`
  const pdfPath = `pdf/${caseNumber}_signed.pdf`

  // Upload using service client (bypasses storage RLS)
  const { error: upErr } = await service.storage
    .from('contracts')
    .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  if (upErr) return { error: `Error al subir el PDF: ${upErr.message}` }

  const signedAt = new Date().toISOString()

  const { error: updateErr } = await service
    .from('contract_documents')
    .update({
      pdf_path: pdfPath,
      pdf_hash: pdfHash,
      pdf_filename: filename,
      estado: 'signed',
      signed_at: signedAt,
      firma_trabajador: firmaTrabajador,
    })
    .eq('id', documentId)

  if (updateErr) return { error: `Error al registrar la firma: ${updateErr.message}` }

  // Audit log (uses worker's own session so user_id is captured correctly)
  const userClient = await createClient()
  await logDocumentAction(userClient, documentId, 'signed', { filename, hash: pdfHash })

  // Permanent forense record
  const h = await headers()
  await service.from('system_logs').insert({
    log_type: 'server_action',
    payload: {
      event: 'contract_signed_by_worker',
      document_id: documentId,
      case_number: caseNumber,
      employee_id: employee.id,
      employee_name: employee.full_name,
      pdf_hash: pdfHash,
      signed_at: signedAt,
      worker_user_id: userId,
      client_ip: h.get('x-forwarded-for') ?? h.get('x-real-ip') ?? 'unknown',
      client_user_agent: h.get('user-agent') ?? 'unknown',
    },
  })

  return { success: true, pdfPath }
}

/**
 * Returns the worker's employee record and their contract documents.
 * Uses service client — worker's RLS is not configured for general reads.
 */
export async function getWorkerContractsAction(): Promise<{
  employee: { id: string; full_name: string; cedula: string; correo: string | null } | null
  documents: {
    id: string
    case_id: string
    document_type: string
    tipo_contrato: string | null
    fecha_inicio: string | null
    fecha_terminacion: string | null
    estado: string
    pdf_path: string | null
    signed_at: string | null
    contract_cases: { case_number: string } | null
  }[]
} | { error: string }> {
  const role = await getUserRole()
  if (role !== 'worker') return { error: 'Unauthorized' }

  const claims = await getUserClaims()
  const userId = claims?.sub
  if (!userId) return { error: 'Unauthorized' }

  const service = await createSupabaseServiceClient()

  const { data: employee } = await service
    .from('employees')
    .select('id, full_name, cedula, correo')
    .eq('user_id', userId)
    .maybeSingle()

  if (!employee) return { employee: null, documents: [] }

  const { data: cases } = await service
    .from('contract_cases')
    .select('id')
    .eq('employee_id', employee.id)

  const caseIds = (cases ?? []).map((c: { id: string }) => c.id)
  if (caseIds.length === 0) return { employee, documents: [] }

  const { data: documents } = await service
    .from('contract_documents')
    .select('id, case_id, document_type, tipo_contrato, fecha_inicio, fecha_terminacion, estado, pdf_path, signed_at, contract_cases(case_number)')
    .in('case_id', caseIds)
    .order('generated_at', { ascending: false })

  type RawDoc = {
    id: string; case_id: string; document_type: string; tipo_contrato: string | null
    fecha_inicio: string | null; fecha_terminacion: string | null; estado: string
    pdf_path: string | null; signed_at: string | null
    contract_cases: { case_number: string }[] | { case_number: string } | null
  }

  const normalized = (documents ?? []).map((d) => {
    const raw = d as unknown as RawDoc
    const cc = Array.isArray(raw.contract_cases) ? raw.contract_cases[0] ?? null : raw.contract_cases
    return { ...raw, contract_cases: cc }
  })

  return { employee, documents: normalized }
}
