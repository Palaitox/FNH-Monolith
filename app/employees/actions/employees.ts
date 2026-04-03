'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import {
  getEmployees,
  getAllEmployees,
  getEmployee,
  bulkUpsertEmployees,
  getEmployeeContracts,
} from '@/app/(shared)/lib/db'
import { revalidatePath } from 'next/cache'
import type { Employee, ExcelEmployee } from '@/app/(shared)/lib/employee-types'

// ── Read ───────────────────────────────────────────────────────────────────

export async function listEmployees(): Promise<Employee[]> {
  const supabase = await createClient()
  return getEmployees(supabase)
}

export async function listAllEmployees(): Promise<Employee[]> {
  const supabase = await createClient()
  return getAllEmployees(supabase)
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const supabase = await createClient()
  return getEmployee(supabase, id)
}

export async function getEmployeeContractsAction(employeeId: string) {
  const supabase = await createClient()
  return getEmployeeContracts(supabase, employeeId)
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createEmployeeAction(
  input: Omit<Employee, 'id' | 'created_at' | 'deactivated_at'>,
): Promise<Employee> {
  await requireRole('coordinator')
  const supabase = await createClient()

  // Explicit INSERT — we do not silently update if cedula already exists.
  // If cedula is taken, Supabase returns a unique-constraint error which we
  // surface to the user as a legible message.
  const { data, error } = await supabase
    .from('employees')
    .insert({
      full_name: input.full_name,
      cedula: String(input.cedula),
      cargo: input.cargo ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
      salario_base: input.salario_base ?? null,
      auxilio_transporte: input.auxilio_transporte ?? 0,
      jornada_laboral: input.jornada_laboral,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Ya existe un empleado con esa cédula.')
    throw error
  }

  revalidatePath('/employees')
  return data
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateEmployeeAction(
  id: string,
  input: Omit<Employee, 'id' | 'created_at' | 'deactivated_at'>,
): Promise<Employee> {
  await requireRole('coordinator')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employees')
    .update({
      full_name: input.full_name,
      cedula: String(input.cedula),
      cargo: input.cargo ?? null,
      telefono: input.telefono ?? null,
      correo: input.correo ?? null,
      salario_base: input.salario_base ?? null,
      auxilio_transporte: input.auxilio_transporte ?? 0,
      jornada_laboral: input.jornada_laboral,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') throw new Error('Ya existe un empleado con esa cédula.')
    throw error
  }

  revalidatePath('/employees')
  revalidatePath(`/employees/${id}`)
  return data
}

// ── Deactivate (soft delete) ───────────────────────────────────────────────

export async function deactivateEmployeeAction(id: string): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error

  revalidatePath('/employees')
  revalidatePath(`/employees/${id}`)
}

export async function reactivateEmployeeAction(id: string): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({ deactivated_at: null })
    .eq('id', id)

  if (error) throw error

  revalidatePath('/employees')
  revalidatePath(`/employees/${id}`)
}

// ── Hard delete ────────────────────────────────────────────────────────────
// Only allowed when the employee has no contracts.
// Requires admin role + explicit confirmation from the caller.

export async function deleteEmployeeAction(id: string): Promise<void> {
  await requireRole('admin')
  const supabase = await createClient()

  // Guard: abort if any contracts reference this employee
  const { count, error: countError } = await supabase
    .from('contracts')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', id)

  if (countError) throw countError
  if ((count ?? 0) > 0) {
    throw new Error(
      'No se puede eliminar: el empleado tiene contratos registrados. Desactívalo en su lugar.',
    )
  }

  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw error

  revalidatePath('/employees')
}

// ── Excel import (Phase 2 — ND-4) ─────────────────────────────────────────
// Phase 1 (parse + diff) happens entirely in the browser via excel-importer.ts.
// This action only receives already-confirmed, user-approved data.

export async function confirmEmployeeImportAction(
  employees: Omit<ExcelEmployee, 'source'>[],
): Promise<{ created: number; updated: number }> {
  await requireRole('coordinator')
  const supabase = await createClient()

  const stats = await bulkUpsertEmployees(
    supabase,
    employees.map((e) => ({ ...e, source: 'excel' as const })),
  )

  revalidatePath('/employees')
  return stats
}
