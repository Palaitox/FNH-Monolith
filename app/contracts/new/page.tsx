'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  listEmployees,
  nextContractNumber,
  createContractAction,
  getAppSettings,
} from '@/app/contracts/actions/contracts'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import type { AppSettings } from '@/app/contracts/types'

const TIPO_OPTIONS = [
  { value: 'tiempo_completo', label: 'Término fijo — Tiempo completo' },
  { value: 'medio_tiempo', label: 'Término fijo — Medio tiempo' },
  { value: 'prestacion_servicios', label: 'Prestación de servicios' },
]

export default function NewContractPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Data
  const [employees, setEmployees] = useState<Employee[]>([])
  const [contractNumber, setContractNumber] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Form state
  const [employeeId, setEmployeeId] = useState('')
  const [tipoContrato, setTipoContrato] = useState('tiempo_completo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTerminacion, setFechaTerminacion] = useState('')
  const [formaPago, setFormaPago] = useState('')

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    Promise.all([listEmployees(), nextContractNumber(), getAppSettings()]).then(
      ([emps, num, cfg]) => {
        setEmployees(emps)
        setContractNumber(num)
        setSettings(cfg)
        if (cfg.formaPago) setFormaPago(cfg.formaPago)
      },
    )
  }, [])

  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null

  async function handleGenerateAndSave() {
    setError(null)

    if (!employeeId || !selectedEmployee) return setError('Selecciona un empleado.')
    if (!fechaInicio) return setError('Ingresa la fecha de inicio.')

    setGenerating(true)
    try {
      // Dynamically import to keep @react-pdf/renderer out of the SSR bundle
      const [{ generateContractPdf }, { buildContractVars }] = await Promise.all([
        import('@/app/contracts/lib/contract-pdf'),
        import('@/app/contracts/lib/pdf-vars'),
      ])

      const vars = buildContractVars(selectedEmployee, {
        numeroContrato: contractNumber,
        fechaInicio,
        fechaTerminacion: fechaTerminacion || undefined,
        lugarTrabajo: settings?.lugarTrabajo ?? '',
      })

      const pdfBlob = await generateContractPdf(vars, tipoContrato)

      // Save contract record first — download is secondary
      const contract = await createContractAction({
        employee_id: employeeId,
        tipo_contrato: tipoContrato,
        fecha_inicio: fechaInicio,
        fecha_terminacion: fechaTerminacion || undefined,
        forma_pago: formaPago || undefined,
      })

      // Trigger browser download only on desktop.
      // On iOS Safari, a.click() on a blob URL navigates the current page to
      // blob:... (the download attribute is ignored), which shows "Load Failed"
      // and kills all subsequent JS — including router.push. Skip on mobile.
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (!isMobile) {
        try {
          const url = URL.createObjectURL(pdfBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = `contrato_${contractNumber}_${selectedEmployee.cedula}.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch {
          // ignore — contract is already saved
        }
      }

      router.push(`/contracts/${contract.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
      setGenerating(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo contrato</h1>
        <p className="text-sm text-muted-foreground mt-1">
          N° <span className="font-mono">{contractNumber || '…'}</span>
        </p>
      </div>

      <div className="rounded-lg border p-6 space-y-5">
        {/* Employee */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Empleado</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} — {e.cedula}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo contrato */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tipo de contrato</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value)}
          >
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha de inicio</label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Fecha de terminación</label>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={fechaTerminacion}
              onChange={(e) => setFechaTerminacion(e.target.value)}
            />
          </div>
        </div>

        {/* Forma de pago */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Forma de pago</label>
          <input
            type="text"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            placeholder={settings?.formaPago ?? ''}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => startTransition(handleGenerateAndSave)}
            disabled={generating || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {generating || isPending ? 'Generando…' : 'Generar y guardar contrato'}
          </button>
          <Link
            href="/contracts"
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  )
}
