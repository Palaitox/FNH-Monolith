'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/client'
import {
  listEmployees,
  listTemplates,
  nextContractNumber,
  createContractAction,
  getAppSettings,
} from '@/app/contracts/actions/contracts'
import { mapEmployeeForContractGen } from '@/app/contracts/types'
import type { Employee, ContractTemplate, AppSettings } from '@/app/contracts/types'

// Browser-only — imported dynamically to avoid SSR
let contractGen: typeof import('@/app/contracts/lib/contract-gen') | null = null

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
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [contractNumber, setContractNumber] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Form state
  const [employeeId, setEmployeeId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [tipoContrato, setTipoContrato] = useState('tiempo_completo')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaTerminacion, setFechaTerminacion] = useState('')
  const [formaPago, setFormaPago] = useState('')

  // UI state
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genLoaded, setGenLoaded] = useState(false)

  useEffect(() => {
    Promise.all([
      listEmployees(),
      listTemplates(),
      nextContractNumber(),
      getAppSettings(),
    ]).then(([emps, tmpls, num, cfg]) => {
      setEmployees(emps)
      setTemplates(tmpls)
      setContractNumber(num)
      setSettings(cfg)
      if (tmpls.length > 0) setTemplateId(tmpls[0].id)
      if (cfg.formaPago) setFormaPago(cfg.formaPago)
    })

    // Pre-load contract-gen module
    import('@/app/contracts/lib/contract-gen').then((m) => {
      contractGen = m
      setGenLoaded(true)
    })
  }, [])

  const selectedEmployee = employees.find((e) => e.id === employeeId) ?? null
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null

  async function handleGenerateAndSave() {
    setError(null)

    if (!employeeId) return setError('Selecciona un empleado.')
    if (!templateId) return setError('Selecciona una plantilla.')
    if (!fechaInicio) return setError('Ingresa la fecha de inicio.')
    if (!contractGen) return setError('Módulo de generación no cargado. Recarga la página.')

    setGenerating(true)
    try {
      // 1. Load template from Supabase Storage
      const supabase = createClient()
      const { data: blob, error: dlErr } = await supabase.storage
        .from('contracts')
        .download(selectedTemplate!.storage_path)

      if (dlErr || !blob) {
        throw new Error(`No se pudo descargar la plantilla: ${dlErr?.message ?? 'error desconocido'}`)
      }

      const templateB64 = await blobToBase64(blob)

      // 2. Generate docx in browser
      const empData = mapEmployeeForContractGen(selectedEmployee!)
      const contractData = {
        numeroContrato: contractNumber,
        tipoContrato,
        fechaInicio,
        fechaTerminacion: fechaTerminacion || undefined,
        lugarTrabajo: settings?.lugarTrabajo ?? '',
        formaPago: formaPago || (settings?.formaPago ?? ''),
      }

      const { blob: docxBlob, filename } = contractGen.downloadContract(
        empData,
        contractData,
        templateB64,
        settings ?? {},
      )

      // 3. Upload docx to Storage
      const docxPath = `docx/${contractNumber}_${selectedEmployee!.cedula}.docx`
      const { error: upErr } = await supabase.storage
        .from('contracts')
        .upload(docxPath, docxBlob, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (upErr) {
        throw new Error(`No se pudo subir el archivo: ${upErr.message}`)
      }

      // 4. Save contract metadata via Server Action
      const contract = await createContractAction({
        employee_id: employeeId,
        template_id: templateId,
        tipo_contrato: tipoContrato,
        fecha_inicio: fechaInicio,
        fecha_terminacion: fechaTerminacion || undefined,
        forma_pago: formaPago || undefined,
      })

      void filename // docx was already downloaded to user's browser by downloadContract()
      router.push(`/contracts/${contract.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido.')
      setGenerating(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
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

        {/* Template */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Plantilla</label>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">Seleccionar…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
        <div className="grid grid-cols-2 gap-4">
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
            disabled={generating || isPending || !genLoaded}
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // result is data:...;base64,<actual_b64> — strip prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Error leyendo el archivo de plantilla.'))
    reader.readAsDataURL(blob)
  })
}
