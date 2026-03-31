import type { DocumentStatus } from '@/app/buses/types'

/**
 * Thresholds (from implementation plan):
 *   Vigente     > 90 days remaining
 *   Seguimiento 61–90 days remaining
 *   Alerta      22–60 days remaining
 *   Crítico     ≤ 21 days OR no expiry date on record
 *
 * Pure function — no I/O, no side effects.
 */
export function computeStatus(
  expiryDate: string | null,
  today: Date = new Date(),
): DocumentStatus {
  if (!expiryDate) return 'Crítico'

  const expiry = new Date(expiryDate + 'T00:00:00')
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  const daysRemaining = Math.floor(
    (expiry.getTime() - todayMidnight.getTime()) / 86_400_000,
  )

  if (daysRemaining > 90) return 'Vigente'
  if (daysRemaining > 60) return 'Seguimiento'
  if (daysRemaining > 21) return 'Alerta'
  return 'Crítico'
}

/** Returns days remaining from today. Negative means already expired. */
export function daysUntilExpiry(
  expiryDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!expiryDate) return null

  const expiry = new Date(expiryDate + 'T00:00:00')
  const todayMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  return Math.floor((expiry.getTime() - todayMidnight.getTime()) / 86_400_000)
}

/** Status priority — higher = worse. Used to compute overall ComplianceResult status. */
export const STATUS_SEVERITY: Record<DocumentStatus, number> = {
  Vigente: 0,
  Seguimiento: 1,
  Alerta: 2,
  Crítico: 3,
}

export function worstStatus(statuses: DocumentStatus[]): DocumentStatus {
  if (statuses.length === 0) return 'Crítico'
  return statuses.reduce((worst, s) =>
    STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst,
  )
}
