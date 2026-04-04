/**
 * employee-types.ts — shared kernel types for the Employee domain.
 *
 * Employee is a core entity referenced by multiple modules:
 *   - employees/  — owns CRUD and lifecycle
 *   - contracts/  — FK contracts.employee_id; reads employees to create contracts
 *
 * Living in (shared)/ ensures both modules can import without cross-module
 * dependencies, which would violate ND-2.
 */

export type JornadaLaboral =
  | 'tiempo_completo'
  | 'medio_tiempo'
  | 'prestacion_servicios'

export interface Employee {
  id: string
  full_name: string
  cedula: string
  cargo: string | null
  telefono: string | null
  correo: string | null
  salario_base: number | null
  auxilio_transporte: number
  jornada_laboral: JornadaLaboral
  deactivated_at: string | null
  created_at: string
}

// ── Excel import ───────────────────────────────────────────────────────────

export interface ExcelEmployee {
  full_name: string
  cedula: string
  cargo: string
  telefono: string
  correo: string
  salario_base: number
  auxilio_transporte: number
  jornada_laboral: JornadaLaboral
  source: 'excel'
}

export interface ExcelImportResult {
  employees: ExcelEmployee[]
  warnings: string[]
  sheetName: string
  totalRows: number
}

export interface ImportDiff {
  new: ExcelEmployee[]
  updated: { old: Employee; new: ExcelEmployee }[]
  unchanged: ExcelEmployee[]
}
