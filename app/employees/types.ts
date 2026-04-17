// Re-export all employee domain types from the shared kernel.
// Code inside employees/ should import from here (keeps paths short and
// makes the boundary between module-local and cross-module types explicit).
export type {
  Employee,
  JornadaLaboral,
  ExcelEmployee,
  ExcelImportResult,
  ImportDiff,
  EmployeeLeave,
  LeaveType,
} from '@/app/(shared)/lib/employee-types'
