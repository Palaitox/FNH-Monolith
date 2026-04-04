export type ContractEstado = 'generated' | 'signed'

export interface Contract {
  id: string
  employee_id: string
  template_id: string | null
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

// ── App settings ───────────────────────────────────────────────────────────

export interface AppSettings {
  lugarTrabajo: string
  formaPago: string
  empleadorNombre: string
  empleadorNit: string
  empleadorRepresentante: string
  ciudadSede?: string
}

// ── Integrity verification ─────────────────────────────────────────────────

export interface IntegrityResult {
  match: boolean
  storedHash: string | null
  computedHash: string | null
  reason?: string
}
