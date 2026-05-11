'use server'

import { createClient } from '@/lib/server'
import { requireRole } from '@/app/(shared)/lib/auth'
import { getEmployeeLeaves, createLeave, closeLeave, getActiveLeavesMap, getEmployees } from '@/app/(shared)/lib/db'
import { revalidatePath } from 'next/cache'
import type { LeaveType, EmployeeLeave } from '@/app/(shared)/lib/employee-types'

export async function getAllActiveLeavesAction(): Promise<
  Array<{ leave: EmployeeLeave; employeeId: string; employeeName: string }>
> {
  const supabase = await createClient()
  const [leavesMap, employees] = await Promise.all([
    getActiveLeavesMap(supabase),
    getEmployees(supabase),
  ])
  const empMap = new Map(employees.map((e) => [e.id, e]))
  const result: Array<{ leave: EmployeeLeave; employeeId: string; employeeName: string }> = []
  for (const [empId, leave] of leavesMap) {
    const emp = empMap.get(empId)
    if (emp) result.push({ leave, employeeId: empId, employeeName: emp.full_name })
  }
  return result.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'es'))
}

export async function getEmployeeLeavesAction(employeeId: string): Promise<EmployeeLeave[]> {
  const supabase = await createClient()
  return getEmployeeLeaves(supabase, employeeId)
}

export async function createLeaveAction(input: {
  employee_id: string
  leave_type: LeaveType
  start_date: string
  expected_end_date?: string | null
  notes?: string | null
}): Promise<EmployeeLeave> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const leave = await createLeave(supabase, input)
  revalidatePath(`/employees/${input.employee_id}`)
  return leave
}

export async function closeLeaveAction(
  leaveId: string,
  employeeId: string,
  actualEndDate: string,
): Promise<void> {
  await requireRole('coordinator')
  const supabase = await createClient()
  await closeLeave(supabase, leaveId, actualEndDate)
  revalidatePath(`/employees/${employeeId}`)
}
