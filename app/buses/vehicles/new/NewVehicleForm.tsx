'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createVehicleAction } from '@/app/buses/actions/buses'

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const fieldClass = "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"

export default function NewVehiclePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [plate, setPlate] = useState('')
  const [type, setType] = useState<'titular' | 'reemplazo'>('titular')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    if (!plate.trim()) return setError('La placa es requerida.')

    startTransition(async () => {
      try {
        const vehicle = await createVehicleAction({ plate: plate.trim(), type })
        router.push(`/buses/vehicles/${vehicle.id}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg.includes('unique') ? 'Ya existe un vehículo con esa placa.' : msg)
      }
    })
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Nuevo vehículo</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <label className={labelClass}>Placa</label>
          <input
            type="text"
            className={`${fieldClass} font-mono uppercase tracking-widest`}
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="Ej: ABC123"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Tipo</label>
          <select
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value as 'titular' | 'reemplazo')}
          >
            <option value="titular">Titular</option>
            <option value="reemplazo">Reemplazo</option>
          </select>
        </div>

        {error && (
          <p className="font-mono text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Guardando…' : 'Guardar vehículo'}
          </button>
          <Link
            href="/buses/vehicles"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
