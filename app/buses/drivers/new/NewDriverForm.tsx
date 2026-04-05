'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createDriverAction } from '@/app/buses/actions/buses'

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const fieldClass = "w-full rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"

export default function NewDriverPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fullName, setFullName] = useState('')
  const [cedula, setCedula] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    setError(null)
    if (!fullName.trim()) return setError('El nombre es requerido.')
    if (!cedula.trim()) return setError('La cédula es requerida.')

    startTransition(async () => {
      try {
        const driver = await createDriverAction({ full_name: fullName.trim(), cedula: cedula.trim() })
        router.push(`/buses/drivers/${driver.id}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg.includes('unique') ? 'Ya existe un conductor con esa cédula.' : msg)
      }
    })
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-md mx-auto space-y-6">
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Nuevo conductor</h1>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-5">
        <div className="space-y-1.5">
          <label className={labelClass}>Nombre completo</label>
          <input
            type="text"
            className={fieldClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ej: Juan Carlos Pérez"
          />
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Cédula de ciudadanía</label>
          <input
            type="text"
            className={`${fieldClass} font-mono`}
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            placeholder="Ej: 1234567890"
          />
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
            {isPending ? 'Guardando…' : 'Guardar conductor'}
          </button>
          <Link
            href="/buses/drivers"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
