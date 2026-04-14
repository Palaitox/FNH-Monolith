// ── Contract Cases (Expediente) ───────────────────────────────────────────

export interface ContractCase {
  id: string
  employee_id: string
  case_number: string
  status: 'active' | 'closed'
  current_end_date: string | null
  created_at: string
}

// ── Contract Documents ────────────────────────────────────────────────────

export type DocumentType = 'INICIAL' | 'PRORROGA' | 'OTRO_SI' | 'TERMINACION'
export type DocumentEstado = 'generated' | 'signed'

export interface ContractDocument {
  id: string
  case_id: string
  document_type: DocumentType
  /** Only set for INICIAL documents */
  tipo_contrato: string | null
  fecha_inicio: string | null
  fecha_terminacion: string | null
  forma_pago: string | null
  affects_term: boolean
  estado: DocumentEstado
  pdf_path: string | null
  pdf_hash: string | null
  pdf_filename: string | null
  generated_at: string
  signed_at: string | null
}

/** ContractDocument with its parent case and employee name joined */
export interface ContractDocumentFull extends ContractDocument {
  contract_cases: (ContractCase & {
    employees: { full_name: string } | null
  }) | null
}

// ── Audit log ─────────────────────────────────────────────────────────────

export interface ContractAuditLog {
  id: string
  document_id: string
  user_id: string | null
  user_email: string | null
  action: string
  details: Record<string, unknown>
  created_at: string
}

// ── App settings ──────────────────────────────────────────────────────────

export interface AppSettings {
  lugarTrabajo: string
  formaPago: string
  empleadorNombre: string
  empleadorNit: string
  empleadorRepresentante: string
  ciudadSede?: string
}

// ── Integrity verification ────────────────────────────────────────────────

export interface IntegrityResult {
  match: boolean
  storedHash: string | null
  computedHash: string | null
  reason?: string
}
