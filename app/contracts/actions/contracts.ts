'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import {
  getContracts,
  getContract,
  createContract as dbCreateContract,
  deleteContract as dbDeleteContract,
  getEmployees,
  getEmployee,
  peekNextContractNumber,
  attachSignedPdf,
  getStats,
  getSettings,
} from '@/app/(shared)/lib/db'
import type {
  ContractWithEmployee,
  AppSettings,
} from '@/app/contracts/types'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

// ── Read ───────────────────────────────────────────────────────────────────

export async function listContracts(): Promise<ContractWithEmployee[]> {
  const supabase = await createClient()
  return getContracts(supabase)
}

export async function getContractById(id: string) {
  const supabase = await createClient()
  return getContract(supabase, id)
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
  return peekNextContractNumber(supabase)
}

export async function getDashboardStats() {
  const supabase = await createClient()
  return getStats(supabase)
}

export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient()
  return getSettings(supabase)
}

// ── Mutations ──────────────────────────────────────────────────────────────

export async function createContractAction(input: {
  employee_id: string
  tipo_contrato: string
  fecha_inicio: string
  fecha_terminacion?: string
  forma_pago?: string
}) {
  await requireRole('coordinator')
  const supabase = await createClient()
  const contract_number = await peekNextContractNumber(supabase)
  const contract = await dbCreateContract(supabase, { ...input, contract_number })
  revalidatePath('/contracts')
  return contract
}

export async function deleteContractAction(id: string) {
  await requireRole('admin')
  const supabase = await createClient()

  // If the contract is signed, write a permanent forense entry to system_logs
  // before the cascade delete removes all contract_audit_logs rows.
  const { data: contract } = await supabase
    .from('contracts')
    .select('estado, contract_number, pdf_filename, pdf_hash, signed_at, employees(full_name)')
    .eq('id', id)
    .maybeSingle()

  if (contract?.estado === 'signed') {
    const { data: { user } } = await supabase.auth.getUser()
    // employees is returned as an array by the Supabase join
    const employeesArr = contract.employees as unknown as { full_name: string }[] | null
    const employeeName = Array.isArray(employeesArr) ? (employeesArr[0]?.full_name ?? null) : null
    await supabase.from('system_logs').insert({
      log_type: 'server_action',
      payload: {
        event: 'signed_contract_deleted',
        contract_id: id,
        contract_number: contract.contract_number ?? null,
        employee_name: employeeName,
        pdf_filename: contract.pdf_filename ?? null,
        pdf_hash: contract.pdf_hash ?? null,
        signed_at: contract.signed_at ?? null,
        deleted_by_email: user?.email ?? null,
        deleted_by_id: user?.id ?? null,
        deleted_at: new Date().toISOString(),
      },
    })
  }

  await dbDeleteContract(supabase, id)
  revalidatePath('/contracts')
  redirect('/contracts')
}

export async function attachSignedPdfAction(
  contractId: string,
  pdfPath: string,
  filename: string,
  pdfHash: string,
) {
  await requireRole('coordinator')
  const supabase = await createClient()
  await attachSignedPdf(supabase, contractId, pdfPath, filename, pdfHash)
  revalidatePath('/contracts')
}
