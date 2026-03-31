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
  upsertEmployee as dbUpsertEmployee,
  bulkUpsertEmployees as dbBulkUpsertEmployees,
  getContractTemplates,
  createContractTemplate as dbCreateContractTemplate,
  deleteContractTemplate as dbDeleteContractTemplate,
  peekNextContractNumber,
  attachSignedPdf,
  getStats,
  getSettings,
} from '@/app/(shared)/lib/db'
import type {
  ContractWithEmployee,
  ContractTemplate,
  Employee,
  ExcelEmployee,
  AppSettings,
} from '@/app/contracts/types'
import { revalidatePath } from 'next/cache'

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

export async function listTemplates() {
  const supabase = await createClient()
  return getContractTemplates(supabase)
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
  template_id: string
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
  await dbDeleteContract(supabase, id)
  revalidatePath('/contracts')
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

// ── Employee mutations ─────────────────────────────────────────────────────

export async function upsertEmployeeAction(emp: Omit<Employee, 'id' | 'created_at'>) {
  await requireRole('coordinator')
  const supabase = await createClient()
  const result = await dbUpsertEmployee(supabase, emp)
  revalidatePath('/contracts')
  return result
}

// ── Template mutations ─────────────────────────────────────────────────────

export async function uploadTemplateAction(
  name: string,
  storagePath: string,
): Promise<ContractTemplate> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const template = await dbCreateContractTemplate(supabase, { name, storage_path: storagePath })
  revalidatePath('/contracts/templates')
  return template
}

export async function deleteTemplateAction(id: string, storagePath: string): Promise<void> {
  await requireRole('admin')
  const supabase = await createClient()
  // Remove storage file first (best-effort — don't block on error)
  await supabase.storage.from('contracts').remove([storagePath]).catch(() => {})
  await dbDeleteContractTemplate(supabase, id)
  revalidatePath('/contracts/templates')
}

// ── Excel import ───────────────────────────────────────────────────────────

/**
 * Phase 2 of Excel import (ND-4): receives already-parsed, user-confirmed data.
 * No DB write happens before this action is called.
 */
export async function confirmExcelImportAction(
  employees: Omit<ExcelEmployee, 'source'>[],
): Promise<{ created: number; updated: number }> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const stats = await dbBulkUpsertEmployees(
    supabase,
    employees.map((e) => ({ ...e, source: 'excel' as const })),
  )
  revalidatePath('/contracts')
  return stats
}
