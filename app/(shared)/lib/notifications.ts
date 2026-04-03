/**
 * notifications.ts
 *
 * Email dispatch abstraction via Resend.
 * Called by the cron route when a document enters Alerta or Crítico.
 *
 * Required env vars:
 *   RESEND_API_KEY           — Resend API key
 *   RESEND_FROM_EMAIL        — Sender address (e.g. "FNH <notificaciones@fnh.org>")
 *   NOTIFICATION_RECIPIENT   — Comma-separated recipient addresses for all alerts
 */

import { Resend } from 'resend'
import type { DocumentStatus } from '@/app/buses/types'

export interface NotificationResult {
  status: 'sent' | 'failed'
  error?: string
}

export interface NotificationPayload {
  entityType: 'driver' | 'vehicle'
  entityName: string   // driver full_name or vehicle plate
  requirementName: string
  newStatus: DocumentStatus
  expiryDate: string | null
}

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const TO: string[] = (process.env.NOTIFICATION_RECIPIENT ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

export async function sendDocumentAlert(
  payload: NotificationPayload,
): Promise<NotificationResult> {
  if (TO.length === 0) {
    console.warn('notifications: NOTIFICATION_RECIPIENT not set — skipping email')
    return { status: 'failed', error: 'NOTIFICATION_RECIPIENT not configured' }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const entityLabel = payload.entityType === 'driver' ? 'Conductor' : 'Vehículo'
  const statusColor = payload.newStatus === 'Crítico' ? '#dc2626' : '#d97706'
  const subject = `[${payload.newStatus}] ${payload.requirementName} — ${entityLabel}: ${payload.entityName}`

  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto">
      <h2 style="color:${statusColor};margin-bottom:4px">${payload.newStatus}</h2>
      <p style="color:#6b7280;margin-top:0;font-size:14px">Alerta documental — Fundación Nuevo Horizonte</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;font-weight:600;border:1px solid #e5e7eb;width:40%">${entityLabel}</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${payload.entityName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;font-weight:600;border:1px solid #e5e7eb">Documento</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${payload.requirementName}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;font-weight:600;border:1px solid #e5e7eb">Estado</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb;color:${statusColor};font-weight:600">${payload.newStatus}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f9fafb;font-weight:600;border:1px solid #e5e7eb">Vencimiento</td>
          <td style="padding:8px 12px;border:1px solid #e5e7eb">${payload.expiryDate ?? 'Sin fecha registrada'}</td>
        </tr>
      </table>

      <p style="margin-top:20px;font-size:12px;color:#9ca3af">
        Esta notificación fue generada automáticamente por el sistema de gestión FNH.
      </p>
    </div>
  `

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      subject,
      html,
    })

    if (error) {
      return { status: 'failed', error: error.message }
    }

    return { status: 'sent' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'failed', error: msg }
  }
}
