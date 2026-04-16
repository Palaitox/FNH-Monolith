'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  listEmployees,
  nextContractNumber,
  createContractAction,
  getCasesForEmployee,
  getAppSettings,
  attachSignedPdfAction,
} from '@/app/contracts/actions/contracts'
import type { Employee } from '@/app/(shared)/lib/employee-types'
import type { AppSettings, ContractCase } from '@/app/contracts/types'

// Initial contracts — these create a new expediente
const TIPO_INICIAL_OPTIONS = [
  { value: 'tiempo_completo',      label: 'Término fijo — Tiempo completo' },
  { value: 'medio_tiempo',         label: 'Término fijo — Medio tiempo' },
  { value: 'prestacion_servicios', label: 'Prestación de servicios' },
]

// Additive documents — attached to an existing expediente
const TIPO_ADICIONAL_OPTIONS = [
  { value: 'otro_si', label: 'Otro Sí — Modificatorio' },
]

export default function NewContractPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pre-fill from query params (e.g. "+ Agregar" button in contracts list)
  const preEmployeeId = searchParams.get('employee_id') ?? ''
  const preCaseId = searchParams.get('case_id') ?? ''

  // Data
  const [employees, setEmployees] = useState<Employee[]>([])
  const [nextCaseNumber, setNextCaseNumber] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Form state
  const [employeeId, setEmployeeId] = useState(preEmployeeId)
  const [tipoContrato, setTipoContrato] = useState(preCaseId ? 'otro_si' : 'tiempo_completo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTerminacion, setFechaTerminacion] = useState('')
  const [formaPago, setFormaPago] = useState('')

  // Otro Sí: available cases for the selected employee
  const [employeeCases, setEmployeeCases] = useState<ContractCase[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState(preCaseId)

  // PDF import: optional for most types, required for 'indefinido'
  const [importPdfFile, setImportPdfFile] = useState<File | null>(null)

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // modoAdicional: arriving with a pre-filled case_id means we're adding to an existing expediente
  const modoAdicional = !!preCaseId
  const tipoOptions   = modoAdicional ? TIPO_ADICIONAL_OPTIONS : TIPO_INICIAL_OPTIONS
  const esOtroSi      = tipoContrato === 'otro_si'

  useEffect(() => {
    Promise.all([listEmployees(), nextContractNumber(), getAppSettings()]).then(
      ([emps, num, cfg]) => {
        setEmployees(emps)
        setNextCaseNumber(num)
        setSettings(cfg)
        if (cfg.formaPago) setFormaPago(cfg.formaPago)
      },
    )
  }, [])

  // When employee changes and tipo is otro_si, load their cases
  useEffect(() => {
    if (!esOtroSi || !employeeId) {
      setEmployeeCases([])
      setSelectedCaseId(esOtroSi ? '' : preCaseId)
      return
    }
    getCasesForEmployee(employeeId).then((cases) => {
      setEmployeeCases(cases)
      // Prefer the pre-filled case_id if it belongs to this employee
      const preMatch = cases.find((c) => c.id === preCaseId)
      setSelectedCaseId(preMatch?.id ?? cases[0]?.id ?? '')
    })
  }, [employeeId, esOtroSi])

  // Reset imported PDF when tipo changes
  useEffect(() => {
    setImportPdfFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [tipoContrato])

  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null
  const selectedCase = employeeCases.find((c) => c.id === selectedCaseId) ?? null

  const displayNumber = esOtroSi
    ? (selectedCase?.case_number ?? '…')
    : (nextCaseNumber || '…')

  async function handleSubmit() {
    setError(null)

    if (!employeeId || !selectedEmployee) return setError('Selecciona un empleado.')
    if (esOtroSi && !selectedCaseId) return setError('Selecciona el expediente contractual al que aplica este Otro Sí.')
    if (!esOtroSi && !fechaInicio) return setError('Ingresa la fecha de inicio.')

    const fechaEfectiva = esOtroSi ? '2026-03-16' : fechaInicio

    setGenerating(true)
    try {
      if (importPdfFile) {
        // ── Import mode: skip PDF generation, create doc + upload + sign ──────
        const doc = await createContractAction({
          employee_id: employeeId,
          document_type: esOtroSi ? 'OTRO_SI' : 'INICIAL',
          tipo_contrato: tipoContrato,
          fecha_inicio: fechaEfectiva,
          fecha_terminacion: esOtroSi ? undefined : (fechaTerminacion || undefined),
          forma_pago: esOtroSi ? undefined : (formaPago || undefined),
          case_id: esOtroSi ? selectedCaseId : undefined,
        })

        const { hashData } = await import('@/app/contracts/lib/security')
        const buffer = await importPdfFile.arrayBuffer()
        const hash = await hashData(buffer)

        const { createClient } = await import('@/lib/client')
        const supabase = createClient()
        const pdfPath = `pdf/${displayNumber}_${Date.now()}.pdf`
        const { error: upErr } = await supabase.storage
          .from('contracts')
          .upload(pdfPath, importPdfFile, { contentType: 'application/pdf', upsert: true })
        if (upErr) throw new Error(`Error al subir el PDF: ${upErr.message}`)

        await attachSignedPdfAction(doc.id, pdfPath, importPdfFile.name, hash)
        router.push(`/contracts/${doc.id}`)
      } else {
        // ── Normal mode: generate PDF from template ───────────────────────────
        const [{ generateContractPdf }, { buildContractVars }] = await Promise.all([
          import('@/app/contracts/lib/contract-pdf'),
          import('@/app/contracts/lib/pdf-vars'),
        ])

        const numeroContrato = esOtroSi ? (selectedCase?.case_number ?? '') : nextCaseNumber

        const vars = buildContractVars(selectedEmployee, {
          numeroContrato,
          fechaInicio: fechaEfectiva,
          fechaTerminacion: esOtroSi ? undefined : (fechaTerminacion || undefined),
          lugarTrabajo: settings?.lugarTrabajo ?? '',
        })

        const pdfBlob = await generateContractPdf(vars, tipoContrato)

        const doc = await createContractAction({
          employee_id: employeeId,
          document_type: esOtroSi ? 'OTRO_SI' : 'INICIAL',
          tipo_contrato: tipoContrato,
          fecha_inicio: fechaEfectiva,
          fecha_terminacion: esOtroSi ? undefined : (fechaTerminacion || undefined),
          forma_pago: esOtroSi ? undefined : (formaPago || undefined),
          case_id: esOtroSi ? selectedCaseId : undefined,
        })

        // Upload unsigned draft to Storage
        try {
          const { createClient } = await import('@/lib/client')
          const supabase = createClient()
          const draftPath = `pdf/${numeroContrato}_draft.pdf`
          await supabase.storage
            .from('contracts')
            .upload(draftPath, pdfBlob, { contentType: 'application/pdf', upsert: true })
        } catch {
          // ignore — contract record is already saved
        }

        const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        if (!isMobile) {
          try {
            const url = URL.createObjectURL(pdfBlob)
            const a = document.createElement('a')
            a.href = url
            a.download = `contrato_${numeroContrato}_${selectedEmployee.cedula}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          } catch {
            // ignore
          }
        }

        router.push(`/contracts/${doc.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
      setGenerating(false)
    }
  }

  const isImporting = !!importPdfFile
  const submitLabel = generating || isPending
    ? (isImporting ? 'Importando…' : 'Generando…')
    : (isImporting ? 'Importar contrato firmado' : 'Generar y guardar contrato')

  return (
    <div className="px-4 py-6 sm:px-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {modoAdicional ? 'Agregar al expediente' : 'Nuevo contrato inicial'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          N° <span className="font-mono">{displayNumber}</span>
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
            {tipoOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Otro Sí: expediente selection */}
        {esOtroSi && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Expediente contractual a modificar</label>
            {!employeeId ? (
              <p className="text-sm text-muted-foreground">Selecciona primero un empleado.</p>
            ) : employeeCases.length === 0 ? (
              <p className="text-sm text-destructive">
                Este empleado no tiene expedientes registrados. Crea primero un contrato inicial.
              </p>
            ) : (
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
              >
                {employeeCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.status === 'active' ? 'Vigente' : 'Cerrado'}
                    {c.current_end_date ? ` (hasta ${c.current_end_date})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Dates — hidden for Otro Sí */}
        {!esOtroSi && (
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
        )}

        {/* Forma de pago — hidden for Otro Sí */}
        {!esOtroSi && (
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
        )}

        {/* PDF import — optional for all initial contract types */}
        {!esOtroSi && (
          <div className="space-y-1.5 rounded-md border border-dashed border-border p-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Importar PDF firmado (opcional)</label>
              {importPdfFile && (
                <button
                  type="button"
                  onClick={() => {
                    setImportPdfFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Quitar
                </button>
              )}
            </div>

            {importPdfFile ? (
              <p className="font-mono text-xs text-muted-foreground truncate">
                {importPdfFile.name}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Si ya tienes el contrato firmado, súbelo aquí y quedará registrado directamente como firmado.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/80 cursor-pointer"
                  onChange={(e) => setImportPdfFile(e.target.files?.[0] ?? null)}
                />
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => startTransition(handleSubmit)}
            disabled={generating || isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {submitLabel}
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
