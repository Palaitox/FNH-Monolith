'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createEmployeeAction } from '@/app/employees/actions/employees'
import type { JornadaLaboral } from '@/app/employees/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
const fieldClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

export default function NewEmployeePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [cedula, setCedula] = useState('')
  const [cargo, setCargo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [salarioBase, setSalarioBase] = useState('')
  const [auxilioTransporte, setAuxilioTransporte] = useState('')
  const [jornada, setJornada] = useState<JornadaLaboral>('tiempo_completo')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) { setError('El nombre es obligatorio.'); return }
    if (!cedula.trim() || isNaN(Number(cedula))) { setError('La cédula debe ser un número válido.'); return }

    startTransition(async () => {
      try {
        const emp = await createEmployeeAction({
          full_name: fullName.trim().toUpperCase(),
          cedula: cedula.trim(),
          cargo: cargo.trim() || null,
          telefono: telefono.trim() || null,
          correo: correo.trim().toLowerCase() || null,
          salario_base: salarioBase ? parseFloat(salarioBase.replace(/[^0-9.]/g, '')) : null,
          auxilio_transporte: auxilioTransporte
            ? parseFloat(auxilioTransporte.replace(/[^0-9.]/g, ''))
            : 0,
          jornada_laboral: jornada,
        })
        router.push(`/employees/${emp.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al crear el empleado.')
      }
    })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      <div>
        <Link
          href="/employees"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Empleados
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Nuevo empleado</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <p className={labelClass}>Datos personales</p>

          <div className="space-y-1.5">
            <label className={labelClass}>Nombre completo *</label>
            <input
              className={fieldClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="NOMBRE APELLIDO"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Cédula *</label>
            <input
              className={`${fieldClass} font-mono`}
              value={cedula}
              onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))}
              placeholder="12345678"
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Cargo</label>
            <input
              className={fieldClass}
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej. AUXILIAR ADMINISTRATIVO"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Teléfono</label>
              <input
                className={`${fieldClass} font-mono`}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="3001234567"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Correo</label>
              <input
                type="email"
                className={fieldClass}
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <p className={labelClass}>Condiciones laborales</p>

          <div className="space-y-1.5">
            <label className={labelClass}>Jornada laboral</label>
            <select
              className={fieldClass}
              value={jornada}
              onChange={(e) => setJornada(e.target.value as JornadaLaboral)}
            >
              <option value="tiempo_completo">Tiempo completo</option>
              <option value="medio_tiempo">Medio tiempo</option>
              <option value="prestacion_servicios">Prestación de servicios</option>
              <option value="termino_indefinido">Término indefinido</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Salario base (COP)</label>
              <input
                className={`${fieldClass} font-mono`}
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                placeholder="1300000"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Auxilio de transporte (COP)</label>
              <input
                className={`${fieldClass} font-mono`}
                value={auxilioTransporte}
                onChange={(e) => setAuxilioTransporte(e.target.value)}
                placeholder="162000"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/employees"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Guardando…' : 'Crear empleado'}
          </button>
        </div>
      </form>
    </main>
  )
}
