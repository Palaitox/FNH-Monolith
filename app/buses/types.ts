export type DocumentStatus = 'Vigente' | 'Seguimiento' | 'Alerta' | 'Crítico'
export type VehicleType = 'titular' | 'reemplazo'
export type DocumentCategory = 'driver' | 'vehicle'

// ── Entities ──────────────────────────────────────────────────────────────

export interface Driver {
  id: string
  full_name: string
  cedula: string
  deactivated_at: string | null
  created_at: string
}

export interface Vehicle {
  id: string
  plate: string
  type: VehicleType
  deactivated_at: string | null
  created_at: string
}

export interface VerificationPair {
  id: string
  vehicle_id: string
  driver_id: string
  verified_at: string
  verified_by: string | null
  deactivated_at: string | null
  created_at: string
}

export interface VerificationPairWithEntities extends VerificationPair {
  vehicles: { plate: string; type: VehicleType } | null
  drivers: { full_name: string; cedula: string } | null
}

// ── Document requirements ──────────────────────────────────────────────────

export interface DocumentRequirement {
  id: string
  name: string
  category: DocumentCategory
  has_expiry: boolean
  effective_from: string
  effective_to: string | null
}

// ── Document events (append-only) ─────────────────────────────────────────

export interface DriverDocumentEvent {
  id: string
  driver_id: string
  requirement_id: string
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
  previous_status: DocumentStatus | null
  recorded_at: string
  recorded_by: string | null
}

export interface VehicleDocumentEvent {
  id: string
  vehicle_id: string
  requirement_id: string
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
  previous_status: DocumentStatus | null
  recorded_at: string
  recorded_by: string | null
}

// ── Compliance view (current status per requirement) ──────────────────────

export interface DocumentStatusRow {
  requirement_id: string
  requirement_name: string
  has_expiry: boolean
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
  recorded_at: string
}

export interface ComplianceResult {
  entity_id: string
  entity_type: 'driver' | 'vehicle'
  rows: DocumentStatusRow[]
  /** Worst status across all requirements */
  overall: DocumentStatus
  /** Counts per status */
  counts: Record<DocumentStatus, number>
}

// ── GA-F-094 Report ────────────────────────────────────────────────────────

export interface GA_F_094_DocumentRow {
  requirement_id: string
  requirement_name: string
  expiry_date: string | null
  is_illegible: boolean
  computed_status: DocumentStatus
}

export interface GA_F_094_Report {
  pair_id: string
  verified_at: string
  verified_by: string | null
  vehicle: { id: string; plate: string; type: VehicleType }
  driver: { id: string; full_name: string; cedula: string }
  vehicle_documents: GA_F_094_DocumentRow[]
  driver_documents: GA_F_094_DocumentRow[]
  generated_at: string
}

// ── Fleet compliance (dashboard) ──────────────────────────────────────────

export interface EntityComplianceSummary {
  id: string
  /** full_name for drivers, plate for vehicles */
  name: string
  entity_type: 'driver' | 'vehicle'
  /** Route to the entity detail page */
  href: string
  overall: DocumentStatus
  counts: Record<DocumentStatus, number>
  /** Names of Crítico or Alerta documents — shown in the attention list */
  urgentDocs: string[]
  /** Required documents that have never been recorded for this entity */
  missingCount: number
}

export interface FleetComplianceSummary {
  entities: EntityComplianceSummary[]
  /** How many entities (not documents) are at each status level */
  entityCounts: Record<DocumentStatus, number>
  /** Subset of entities with overall = Crítico or Alerta, sorted worst-first */
  needsAttention: EntityComplianceSummary[]
  totalEntities: number
  lastComputedAt: string
}

// ── Input types for mutations ──────────────────────────────────────────────

export interface RecordDocumentInput {
  requirement_id: string
  expiry_date: string | null
  is_illegible: boolean
}
