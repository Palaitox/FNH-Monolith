'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/app/buses/components/StatusBadge'
import { daysUntilExpiry } from '@/app/buses/lib/expiry-calculator'
import {
  recordDriverDocumentsAction,
  deactivateDriverAction,
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

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null
  if (days < 0)
    return <p className="text-xs text-red-500">Vencido hace {Math.abs(days)} días</p>
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

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const btnPrimary = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
const btnSecondary = "rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
const fieldClass = "rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"

export default function DriverDetail({ driver, compliance, requirements }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deactivateConfirm, setDeactivateConfirm] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)

  const [docInputs, setDocInputs] = useState<
    Record<string, { expiry_date: string; is_illegible: boolean }>
  >(() =>
    Object.fromEntries(
      requirements.map((r) => [
        r.id,
        {
          expiry_date: compliance.rows.find((row) => row.requirement_id === r.id)?.expiry_date ?? '',
          is_illegible: compliance.rows.find((row) => row.requirement_id === r.id)?.is_illegible ?? false,
        },
      ]),
    ),
  )

  function handleSaveDocs() {
    setError(null)
    const documents: RecordDocumentInput[] = requirements.map((r) => ({
      requirement_id: r.id,
      expiry_date: docInputs[r.id]?.expiry_date || null,
      is_illegible: docInputs[r.id]?.is_illegible ?? false,
      has_expiry: r.has_expiry,
    }))
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

      {/* Summary counts */}
      <div className="grid grid-cols-4 gap-3">
        {(['Vigente', 'Seguimiento', 'Alerta', 'Crítico'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3 text-center space-y-2">
            <p className="text-2xl font-semibold tracking-tight">{compliance.counts[s]}</p>
            <StatusBadge status={s} />
          </div>
        ))}
      </div>

      {/* Document status table */}
      {compliance.rows.length > 0 ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {compliance.rows.map((row) => (
                <tr key={row.requirement_id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {row.requirement_name}
                    {row.is_illegible && (
                      <span className="ml-2 font-mono text-xs text-amber-500">(ilegible)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.expiry_date ? (
                      <div className="space-y-0.5">
                        <p className="font-mono text-sm text-muted-foreground">{row.expiry_date}</p>
                        <DaysChip days={daysUntilExpiry(row.expiry_date)} />
                      </div>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">
                        {row.has_expiry ? '—' : 'Sin vencimiento'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.computed_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No hay registros documentales. Usa el botón de abajo para ingresar los documentos.
        </div>
      )}

      {/* Document entry form */}
      {showDocForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className={labelClass}>Registrar / actualizar documentos</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {requirements.map((req) => (
              <div key={req.id} className="flex items-center gap-3 py-1">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{req.name}</p>
                </div>
                {req.has_expiry ? (
                  <input
                    type="date"
                    className={`${fieldClass} w-36`}
                    value={docInputs[req.id]?.expiry_date ?? ''}
                    onChange={(e) =>
                      setDocInputs((prev) => ({
                        ...prev,
                        [req.id]: { ...prev[req.id], expiry_date: e.target.value },
                      }))
                    }
                  />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground w-36 text-center">Sin vencimiento</span>
                )}
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={docInputs[req.id]?.is_illegible ?? false}
                    onChange={(e) =>
                      setDocInputs((prev) => ({
                        ...prev,
                        [req.id]: { ...prev[req.id], is_illegible: e.target.checked },
                      }))
                    }
                  />
                  Ilegible
                </label>
              </div>
            ))}
          </div>

          {error && (
            <p className="font-mono text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5">{error}</p>
          )}

          <div className="flex gap-2">
            <button onClick={handleSaveDocs} disabled={isPending} className={btnPrimary}>
              {isPending ? 'Guardando…' : 'Guardar documentos'}
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
            Actualizar documentos
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
      </div>
    </div>
  )
}
