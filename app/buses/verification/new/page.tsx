'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { listDrivers, listVehicles, createVerificationPairAction } from '@/app/buses/actions/buses'
import type { Driver, Vehicle } from '@/app/buses/types'

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const fieldClass = "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"

export default function NewVerificationPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [driverId, setDriverId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [verifiedAt, setVerifiedAt] = useState(new Date().toISOString().slice(0, 10))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listDrivers(), listVehicles()]).then(([d, v]) => {
      setDrivers(d)
      setVehicles(v)
    })
  }, [])

  function handleSubmit() {
    setError(null)
    if (!driverId) return setError('Selecciona un conductor.')
    if (!vehicleId) return setError('Selecciona un vehículo.')
    if (!verifiedAt) return setError('La fecha de verificación es requerida.')

    startTransition(async () => {
      try {
        const pair = await createVerificationPairAction({
          driver_id: driverId,
          vehicle_id: vehicleId,
          verified_at: new Date(verifiedAt + 'T12:00:00').toISOString(),
        })
        router.push(`/buses/verification/${pair.id}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al crear la verificación.')
      }
    })
  }

  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Nueva verificación</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <label className={labelClass}>Conductor</label>
          <select
            className={fieldClass}
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} — {d.cedula}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Vehículo</label>
          <select
            className={fieldClass}
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} — {v.type}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Fecha de verificación</label>
          <input
            type="date"
            className={`${fieldClass} font-mono`}
            value={verifiedAt}
            onChange={(e) => setVerifiedAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground/70">
            Ancla la reconstrucción histórica del reporte GA-F-094.
          </p>
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
            {isPending ? 'Creando…' : 'Crear verificación'}
          </button>
          <Link
            href="/buses/verification"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
