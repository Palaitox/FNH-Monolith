'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/app/buses/components/StatusBadge'
import { daysUntilExpiry } from '@/app/buses/lib/expiry-calculator'
import {
  recordDriverDocumentsAction,
  deactivateDriverAction,
  deleteDriverAction,
} from '@/app/buses/actions/buses'
import type {
  Driver,
  ComplianceResult,
  DocumentRequirement,
  RecordDocumentInput,
} from '@/app/buses/types'

interface Props {
  driver: Driver
  compliance: ComplianceResult
  requirements: DocumentRequirement[]
}

// ── Helpers ───────────────────────────────────────────────────────────────

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null
  if (days < 0)
    return <p className="text-xs text-red-500">Vencida hace {Math.abs(days)} días</p>
  if (days === 0)
    return <p className="text-xs text-red-500">Vence hoy</p>
  if (days <= 21)
    return <p className="text-xs text-red-500">{days} día{days !== 1 ? 's' : ''}</p>
  if (days <= 60)
    return <p className="text-xs text-amber-500">{days} días</p>
  if (days <= 90)
    return <p className="text-xs text-blue-500">{days} días</p>
  return <p className="text-xs text-green-500">{days} días</p>
}

function PresentedChip() {
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Presentado
    </span>
  )
}

function PendingChip() {
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      Pendiente
    </span>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const btnPrimary = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
const btnSecondary = "rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
const fieldClass = "rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"

// ── Component ─────────────────────────────────────────────────────────────

export default function DriverDetail({ driver, compliance, requirements }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)

  const recordedIds = new Set(compliance.rows.map((r) => r.requirement_id))

  // Checklist items (has_expiry=false): checked if already recorded (disabled),
  // unchecked if not yet recorded (editable).
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      requirements
        .filter((r) => !r.has_expiry)
        .map((r) => [r.id, recordedIds.has(r.id)]),
    ),
  )

  // Expiry items (has_expiry=true): pre-fill from latest recorded event.
  const [expiryInputs, setExpiryInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      requirements
        .filter((r) => r.has_expiry)
        .map((r) => [
          r.id,
          compliance.rows.find((row) => row.requirement_id === r.id)?.expiry_date ?? '',
        ]),
    ),
  )

  const checklistReqs = requirements.filter((r) => !r.has_expiry)
  const expiryReqs = requirements.filter((r) => r.has_expiry)

  // Count checklist progress
  const checklistTotal = checklistReqs.length
  const checklistDone = checklistReqs.filter((r) => recordedIds.has(r.id)).length

  function handleSaveDocs() {
    setError(null)

    const documents: RecordDocumentInput[] = [
      // Only submit newly-checked checklist items (already recorded ones need no new event)
      ...checklistReqs
        .filter((r) => checked[r.id] && !recordedIds.has(r.id))
        .map((r) => ({
          requirement_id: r.id,
          expiry_date: null,
          is_illegible: false,
          has_expiry: false,
        })),
      // Submit expiry items that have a date
      ...expiryReqs
        .filter((r) => expiryInputs[r.id])
        .map((r) => ({
          requirement_id: r.id,
          expiry_date: expiryInputs[r.id],
          is_illegible: false,
          has_expiry: true,
        })),
    ]

    if (documents.length === 0) {
      setError('No hay cambios nuevos para guardar.')
      return
    }

    startTransition(async () => {
      try {
        await recordDriverDocumentsAction(driver.id, documents)
        setShowDocForm(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al guardar documentos.')
      }
    })
  }

  function handleDeactivate() {
    if (!deactivateConfirm) { setDeactivateConfirm(true); return }
    startTransition(async () => {
      await deactivateDriverAction(driver.id)
      router.push('/buses/drivers')
    })
  }

  function handleDelete() {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    startTransition(async () => {
      await deleteDriverAction(driver.id)
      router.push('/buses/drivers')
    })
  }

  const isActive = !driver.deactivated_at

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{driver.full_name}</h1>
          <p className="font-mono text-sm text-muted-foreground">{driver.cedula}</p>
        </div>
        <StatusBadge status={compliance.overall} />
      </div>

      {/* Checklist progress + expiry counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 rounded-lg border border-border bg-card p-3 flex items-center gap-4">
          <div className="flex-1">
            <p className={labelClass}>Documentos entregados</p>
            <p className="text-2xl font-semibold tracking-tight mt-1">
              {checklistDone}
              <span className="text-base font-normal text-muted-foreground">/{checklistTotal}</span>
            </p>
          </div>
          <div className="w-16 h-16 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                strokeWidth="2.5" className="text-muted/30" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeDasharray={`${(checklistDone / checklistTotal) * 100} 100`}
                strokeLinecap="round"
                className={checklistDone === checklistTotal ? 'text-green-500' : 'text-primary'} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold rotate-0">
              {Math.round((checklistDone / checklistTotal) * 100)}%
            </span>
          </div>
        </div>
        {(['Vigente', 'Seguimiento', 'Alerta', 'Crítico'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3 text-center space-y-2">
            <p className="text-2xl font-semibold tracking-tight">{compliance.counts[s]}</p>
            <StatusBadge status={s} />
          </div>
        ))}
      </div>

      {/* Documents table — all requirements */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Documento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((req) => {
              const recorded = compliance.rows.find((r) => r.requirement_id === req.id)
              return (
                <tr key={req.id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">{req.name}</td>
                  <td className="px-4 py-3">
                    {req.has_expiry ? (
                      recorded
                        ? <StatusBadge status={recorded.computed_status} />
                        : <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Sin registrar</span>
                    ) : (
                      recorded ? <PresentedChip /> : <PendingChip />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {req.has_expiry && recorded?.expiry_date ? (
                      <div className="space-y-0.5">
                        <p className="font-mono text-sm">{recorded.expiry_date}</p>
                        <DaysChip days={daysUntilExpiry(recorded.expiry_date)} />
                      </div>
                    ) : (
                      <span className="text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Document entry form */}
      {showDocForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-5">
          <h2 className={labelClass}>Registrar documentos</h2>

          {/* Checklist section */}
          {checklistReqs.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-2">
                Los documentos ya entregados aparecen marcados y no se pueden desmarcar.
              </p>
              {checklistReqs.map((req) => {
                const alreadyRecorded = recordedIds.has(req.id)
                return (
                  <label
                    key={req.id}
                    className={`flex items-center gap-3 py-2 px-3 rounded-md transition-colors ${
                      alreadyRecorded
                        ? 'opacity-60 cursor-not-allowed'
                        : 'cursor-pointer hover:bg-muted/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked[req.id] ?? false}
                      disabled={alreadyRecorded}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [req.id]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">{req.name}</span>
                    {alreadyRecorded && <PresentedChip />}
                  </label>
                )
              })}
            </div>
          )}

          {/* Expiry section */}
          {expiryReqs.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className={labelClass}>Con fecha de vencimiento</p>
              {expiryReqs.map((req) => (
                <div key={req.id} className="flex items-center gap-3 py-1">
                  <span className="flex-1 text-sm">{req.name}</span>
                  <input
                    type="date"
                    className={`${fieldClass} w-36`}
                    value={expiryInputs[req.id] ?? ''}
                    onChange={(e) =>
                      setExpiryInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="font-mono text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5">{error}</p>
          )}

          <div className="flex gap-2">
            <button onClick={handleSaveDocs} disabled={isPending} className={btnPrimary}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </button>
            <button onClick={() => setShowDocForm(false)} className={btnSecondary}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link href="/buses/drivers" className={btnSecondary}>← Volver</Link>
        {!showDocForm && (
          <button onClick={() => setShowDocForm(true)} className={btnPrimary}>
            Registrar documentos
          </button>
        )}
        {isActive && (
          <button
            onClick={handleDeactivate}
            disabled={isPending}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              deactivateConfirm
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            {deactivateConfirm ? 'Confirmar desactivación' : 'Desactivar conductor'}
          </button>
        )}
        {deactivateConfirm && (
          <button onClick={() => setDeactivateConfirm(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            deleteConfirm
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'border border-destructive/40 text-destructive/70 hover:border-destructive hover:text-destructive'
          }`}
        >
          {deleteConfirm ? 'Confirmar eliminación permanente' : 'Eliminar conductor'}
        </button>
        {deleteConfirm && (
          <button onClick={() => setDeleteConfirm(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
