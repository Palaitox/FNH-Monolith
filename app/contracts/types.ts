export type JornadaLaboral = 'tiempo_completo' | 'medio_tiempo' | 'prestacion_servicios'
export type ContractEstado = 'generated' | 'signed'

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
  created_at: string
}

export interface ContractTemplate {
  id: string
  name: string
  storage_path: string
  created_at: string
}

export interface Contract {
  id: string
  employee_id: string
  template_id: string
  contract_number: string | null
  tipo_contrato: string | null
  fecha_inicio: string | null
  fecha_terminacion: string | null
  forma_pago: string | null
  estado: ContractEstado
  docx_path: string | null
  pdf_path: string | null
  pdf_hash: string | null
  pdf_filename: string | null
  generated_at: string
  signed_at: string | null
}

export interface ContractWithEmployee extends Contract {
  employees: { full_name: string } | null
}

export interface ContractAuditLog {
  id: string
  contract_id: string
  user_id: string | null
  user_email: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

// ── Excel importer ─────────────────────────────────────────────────────────

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

// ── App settings ───────────────────────────────────────────────────────────

export interface AppSettings {
  lugarTrabajo: string
  formaPago: string
  empleadorNombre: string
  empleadorNit: string
  empleadorRepresentante: string
  ciudadSede?: string
}

// ── contract-gen.js interop ────────────────────────────────────────────────
// contract-gen.js expects camelCase fields different from DB snake_case.
// Use mapEmployeeForContractGen() before passing to generateContractDocx().

export interface ContractGenEmployee {
  nombre: string
  cargo: string
  cedula: string
  salarioBase: number
  auxilioTransporte: number
  telefono?: string
  correo?: string
  ciudad?: string
}

export function mapEmployeeForContractGen(e: Employee): ContractGenEmployee {
  return {
    nombre: e.full_name,
    cargo: e.cargo ?? '',
    cedula: e.cedula,
    salarioBase: e.salario_base ?? 0,
    auxilioTransporte: e.auxilio_transporte,
    telefono: e.telefono ?? undefined,
    correo: e.correo ?? undefined,
  }
}

// ── Integrity verification ─────────────────────────────────────────────────

export interface IntegrityResult {
  match: boolean
  storedHash: string | null
  computedHash: string | null
  reason?: string
}
