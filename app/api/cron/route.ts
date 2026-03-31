/**
 * app/api/cron/route.ts
 *
 * Vercel Cron handler — runs daily at 0 11 * * * UTC (06:00 Colombia).
 *
 * Algorithm (ND-1 corrected — see systemDesignFinal.md § 5):
 *   For each active (entity × requirement):
 *     1. Compute new_status via expiry-calculator
 *     2. Fetch previous_status from latest event row
 *     3. Insert new event row unconditionally
 *     4. Check should_notify (ND-1 two-branch condition)
 *     5. If should_notify: send email → insert notification_log
 *   Then retry pass for failed/retrying rows (retry_count < 3).
 *   Finally write structured system_logs entry.
 *
 * Security: header Authorization: Bearer <CRON_SECRET>
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/app/(shared)/lib/auth'
import { computeStatus } from '@/app/buses/lib/expiry-calculator'
import { sendDocumentAlert } from '@/app/(shared)/lib/notifications'
import type { DocumentStatus } from '@/app/buses/types'

export async function GET(request: NextRequest) {
  // ── Auth ───────────────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const runId = crypto.randomUUID()
  const startedAt = new Date()

  const counts = { processed: 0, transitions: 0, notified: 0, failed: 0 }

  try {
    const supabase = await createSupabaseServiceClient()
    const today = new Date()

    // ── Step 1: active drivers × requirements ───────────────────────────
    const { data: activeDrivers } = await supabase
      .from('drivers')
      .select('id, full_name')
      .is('deactivated_at', null)

    const { data: activeVehicles } = await supabase
      .from('vehicles')
      .select('id, plate')
      .is('deactivated_at', null)

    const { data: driverRequirements } = await supabase
      .from('document_requirements')
      .select('id, name, has_expiry')
      .eq('category', 'driver')
      .lte('effective_from', today.toISOString().slice(0, 10))
      .or(`effective_to.is.null,effective_to.gt.${today.toISOString().slice(0, 10)}`)

    const { data: vehicleRequirements } = await supabase
      .from('document_requirements')
      .select('id, name, has_expiry')
      .eq('category', 'vehicle')
      .lte('effective_from', today.toISOString().slice(0, 10))
      .or(`effective_to.is.null,effective_to.gt.${today.toISOString().slice(0, 10)}`)

    // ── Step 2: process each driver × requirement ───────────────────────
    for (const driver of activeDrivers ?? []) {
      for (const req of driverRequirements ?? []) {
        counts.processed++

        // Fetch latest event for this driver × requirement
        const { data: latestEvents } = await supabase
          .from('driver_document_events')
          .select('id, expiry_date, computed_status')
          .eq('driver_id', driver.id)
          .eq('requirement_id', req.id)
          .order('recorded_at', { ascending: false })
          .limit(1)

        const latest = latestEvents?.[0] ?? null
        const previousStatus = (latest?.computed_status ?? null) as DocumentStatus | null
        const expiryDate = latest?.expiry_date ?? null

        // Only process requirements that have been recorded at least once
        // (cron recalculates existing records; initial recording is manual)
        if (!latest) continue

        const newStatus = computeStatus(expiryDate, today)
        if (newStatus !== previousStatus) counts.transitions++

        // Insert new event row unconditionally
        const { data: newEvent, error: insertErr } = await supabase
          .from('driver_document_events')
          .insert({
            driver_id: driver.id,
            requirement_id: req.id,
            expiry_date: expiryDate,
            is_illegible: false,
            computed_status: newStatus,
            previous_status: previousStatus,
            recorded_by: null, // cron-written
          })
          .select('id')
          .single()

        if (insertErr || !newEvent) {
          console.error(`cron: insert driver event failed`, insertErr)
          continue
        }

        // ── ND-1 corrected notification check ─────────────────────────
        if (newStatus === 'Alerta' || newStatus === 'Crítico') {
          const shouldNotify = await checkShouldNotify(
            supabase,
            newEvent.id,
            'driver_document_events',
            newStatus,
            newStatus !== previousStatus,
          )

          if (shouldNotify) {
            const result = await sendDocumentAlert({
              entityType: 'driver',
              entityName: driver.full_name,
              requirementName: req.name,
              newStatus,
              expiryDate,
            })

            await supabase.from('notification_log').insert({
              event_id: newEvent.id,
              event_table: 'driver_document_events',
              alert_type: newStatus,
              delivery_status: result.status,
              failure_reason: result.error ?? null,
              retry_count: 0,
            })

            if (result.status === 'sent') counts.notified++
            else counts.failed++
          }
        }
      }
    }

    // ── Step 3: process each vehicle × requirement ──────────────────────
    for (const vehicle of activeVehicles ?? []) {
      for (const req of vehicleRequirements ?? []) {
        counts.processed++

        const { data: latestEvents } = await supabase
          .from('vehicle_document_events')
          .select('id, expiry_date, computed_status')
          .eq('vehicle_id', vehicle.id)
          .eq('requirement_id', req.id)
          .order('recorded_at', { ascending: false })
          .limit(1)

        const latest = latestEvents?.[0] ?? null
        const previousStatus = (latest?.computed_status ?? null) as DocumentStatus | null
        const expiryDate = latest?.expiry_date ?? null

        if (!latest) continue

        const newStatus = computeStatus(expiryDate, today)
        if (newStatus !== previousStatus) counts.transitions++

        const { data: newEvent, error: insertErr } = await supabase
          .from('vehicle_document_events')
          .insert({
            vehicle_id: vehicle.id,
            requirement_id: req.id,
            expiry_date: expiryDate,
            is_illegible: false,
            computed_status: newStatus,
            previous_status: previousStatus,
            recorded_by: null,
          })
          .select('id')
          .single()

        if (insertErr || !newEvent) {
          console.error(`cron: insert vehicle event failed`, insertErr)
          continue
        }

        if (newStatus === 'Alerta' || newStatus === 'Crítico') {
          const shouldNotify = await checkShouldNotify(
            supabase,
            newEvent.id,
            'vehicle_document_events',
            newStatus,
            newStatus !== previousStatus,
          )

          if (shouldNotify) {
            const result = await sendDocumentAlert({
              entityType: 'vehicle',
              entityName: vehicle.plate,
              requirementName: req.name,
              newStatus,
              expiryDate,
            })

            await supabase.from('notification_log').insert({
              event_id: newEvent.id,
              event_table: 'vehicle_document_events',
              alert_type: newStatus,
              delivery_status: result.status,
              failure_reason: result.error ?? null,
              retry_count: 0,
            })

            if (result.status === 'sent') counts.notified++
            else counts.failed++
          }
        }
      }
    }

    // ── Step 4: retry pass ──────────────────────────────────────────────
    const { data: retryRows } = await supabase
      .from('notification_log')
      .select('*')
      .in('delivery_status', ['failed', 'retrying'])
      .lt('retry_count', 3)

    for (const row of retryRows ?? []) {
      // Fetch original event to reconstruct payload
      const table = row.event_table as 'driver_document_events' | 'vehicle_document_events'
      const isDriver = table === 'driver_document_events'

      const { data: eventData } = await supabase
        .from(table)
        .select(isDriver
          ? 'expiry_date, computed_status, requirement_id, driver_id, document_requirements(name), drivers(full_name)'
          : 'expiry_date, computed_status, requirement_id, vehicle_id, document_requirements(name), vehicles(plate)',
        )
        .eq('id', row.event_id)
        .single()

      if (!eventData) continue

      const ev = eventData as Record<string, unknown>
      const reqName = (ev.document_requirements as { name: string } | null)?.name ?? '—'
      const entityName = isDriver
        ? (ev.drivers as { full_name: string } | null)?.full_name ?? '—'
        : (ev.vehicles as { plate: string } | null)?.plate ?? '—'

      const result = await sendDocumentAlert({
        entityType: isDriver ? 'driver' : 'vehicle',
        entityName,
        requirementName: reqName,
        newStatus: row.alert_type as DocumentStatus,
        expiryDate: ev.expiry_date as string | null,
      })

      await supabase
        .from('notification_log')
        .update({
          delivery_status: result.status === 'sent' ? 'sent' : 'retrying',
          failure_reason: result.error ?? null,
          retry_count: (row.retry_count as number) + 1,
        })
        .eq('id', row.id)
    }

    // ── Step 5: write system_logs ───────────────────────────────────────
    const durationMs = Date.now() - startedAt.getTime()
    await supabase.from('system_logs').insert({
      log_type: 'cron',
      payload: {
        run_id: runId,
        started_at: startedAt.toISOString(),
        duration_ms: durationMs,
        processed: counts.processed,
        transitions: counts.transitions,
        notified: counts.notified,
        failed: counts.failed,
      },
    })

    return NextResponse.json({ ok: true, run_id: runId, ...counts })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('cron: unhandled error', msg)

    // Still write a failure log so the absence is detectable
    try {
      const supabase = await createSupabaseServiceClient()
      await supabase.from('system_logs').insert({
        log_type: 'cron',
        payload: {
          run_id: runId,
          started_at: startedAt.toISOString(),
          duration_ms: Date.now() - startedAt.getTime(),
          error: msg,
          ...counts,
        },
      })
    } catch { /* best-effort */ }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── ND-1 corrected notification check ─────────────────────────────────────
// should_notify =
//   (new_status != previous_status AND new_status in [Alerta, Crítico])
//   OR
//   (new_status in [Alerta, Crítico]
//    AND no sent row exists in notification_log for this event_id today)
//
// Note: we pass in statusTransitioned rather than re-deriving it, because
// previousStatus is already known at the call site.

async function checkShouldNotify(
  supabase: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  eventId: string,
  eventTable: 'driver_document_events' | 'vehicle_document_events',
  newStatus: 'Alerta' | 'Crítico',
  statusTransitioned: boolean,
): Promise<boolean> {
  // Branch 1: status changed into Alerta/Crítico
  if (statusTransitioned) return true

  // Branch 2: already in Alerta/Crítico — check if no notification sent today (UTC)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('event_id', eventId)
    .eq('event_table', eventTable)
    .eq('alert_type', newStatus)
    .eq('delivery_status', 'sent')
    .gte('notified_at', todayStart.toISOString())
    .limit(1)

  return (data?.length ?? 0) === 0
}
