import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmployeeLeave, LeaveType } from '@/app/(shared)/lib/employee-types'

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
