'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { parseExcelEmployees, diffEmployees } from '@/app/contracts/lib/excel-importer'
import { listEmployees, confirmExcelImportAction } from '@/app/contracts/actions/contracts'
import type { ImportDiff, ExcelEmployee } from '@/app/contracts/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

type Phase = 'upload' | 'preview' | 'done'

interface DoneResult {
  created: number
  updated: number
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('upload')
  const [isParsing, startParsing] = useTransition()
  const [isConfirming, startConfirming] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [diff, setDiff] = useState<ImportDiff | null>(null)
  const [parsed, setParsed] = useState<ExcelEmployee[]>([])
  const [result, setResult] = useState<DoneResult | null>(null)
  const [sheetInfo, setSheetInfo] = useState<{ name: string; total: number } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    startParsing(async () => {
      try {
        const buffer = await file.arrayBuffer()
        const importResult = await parseExcelEmployees(buffer)
        const existing = await listEmployees()
        const diffResult = diffEmployees(existing, importResult.employees)

        setParsed(importResult.employees)
        setDiff(diffResult)
        setWarnings(importResult.warnings)
        setSheetInfo({ name: importResult.sheetName, total: importResult.totalRows })
        setPhase('preview')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al procesar el archivo.')
      }
    })
  }

  function handleConfirm() {
    if (!parsed.length) return
    startConfirming(async () => {
      try {
        const res = await confirmExcelImportAction(parsed.map(({ source, ...e }) => e))
        setResult(res)
        setPhase('done')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al confirmar la importación.')
      }
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Importar empleados</h1>
          <p className="text-sm text-muted-foreground">
            Carga un archivo Excel con datos de empleados para actualizar la base.
          </p>
        </div>
        <Link
          href="/contracts"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          Volver
        </Link>
      </div>

      {/* Phase: upload */}
      {phase === 'upload' && (
        <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-4">
          <div className="rounded-full border border-border bg-muted/20 p-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">Selecciona un archivo .xlsx o .xls</p>
            <p className="text-xs text-muted-foreground">
              El archivo debe tener columnas NOMBRE y CEDULA/DOCUMENTO
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={isParsing}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isParsing ? 'Procesando…' : 'Seleccionar archivo'}
          </button>
          {error && (
            <p className="font-mono text-sm text-destructive bg-destructive/10 rounded px-3 py-2 w-full text-center">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Phase: preview */}
      {phase === 'preview' && diff && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Nuevos" value={diff.new.length} color="text-emerald-400" />
            <StatCard label="Actualizados" value={diff.updated.length} color="text-amber-400" />
            <StatCard label="Sin cambios" value={diff.unchanged.length} color="text-muted-foreground" />
          </div>

          {sheetInfo && (
            <p className="text-xs text-muted-foreground font-mono">
              Hoja: {sheetInfo.name} · {sheetInfo.total} filas procesadas · {parsed.length} empleados detectados
            </p>
          )}

          {warnings.length > 0 && (
            <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <p className={`${labelClass} text-amber-400`}>Advertencias</p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="font-mono text-xs text-amber-400/80">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* New employees */}
          {diff.new.length > 0 && (
            <Section title="Empleados nuevos" count={diff.new.length} color="text-emerald-400">
              <EmployeeTable rows={diff.new.map(e => ({
                cedula: e.cedula,
                name: e.full_name,
                cargo: e.cargo,
                salario: e.salario_base,
              }))} />
            </Section>
          )}

          {/* Updated employees */}
          {diff.updated.length > 0 && (
            <Section title="Empleados actualizados" count={diff.updated.length} color="text-amber-400">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                      <th className="px-3 py-2 text-left">Cédula</th>
                      <th className="px-3 py-2 text-left">Campo</th>
                      <th className="px-3 py-2 text-left">Antes</th>
                      <th className="px-3 py-2 text-left">Después</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {diff.updated.map(({ old: o, new: n }) => (
                      <ChangeRows key={o.cedula} old={o} incoming={n} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {error && (
            <p className="font-mono text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              disabled={isConfirming || (diff.new.length === 0 && diff.updated.length === 0)}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isConfirming
                ? 'Importando…'
                : `Confirmar importación (${diff.new.length + diff.updated.length} cambios)`}
            </button>
            <button
              onClick={() => {
                setPhase('upload')
                setDiff(null)
                setParsed([])
                setError(null)
                setWarnings([])
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Phase: done */}
      {phase === 'done' && result && (
        <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-4">
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-4">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold">Importación completada</p>
            <p className="font-mono text-xs text-muted-foreground">
              {result.created} creados · {result.updated} actualizados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setPhase('upload')
                setDiff(null)
                setParsed([])
                setResult(null)
                setError(null)
                setWarnings([])
                if (fileRef.current) fileRef.current.value = ''
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Importar otro
            </button>
            <Link
              href="/contracts/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Crear contrato
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

function Section({
  title,
  count,
  color,
  children,
}: {
  title: string
  count: number
  color: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <span className={`font-mono text-xs ${color}`}>{count}</span>
      </div>
      {children}
    </div>
  )
}

function EmployeeTable(props: { rows: { cedula: string; name: string; cargo: string; salario: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
            <th className="px-3 py-2 text-left">Cédula</th>
            <th className="px-3 py-2 text-left">Nombre</th>
            <th className="px-3 py-2 text-left">Cargo</th>
            <th className="px-3 py-2 text-right">Salario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {props.rows.map((r) => (
            <tr key={r.cedula} className="hover:bg-muted/20 transition-colors">
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.cedula}</td>
              <td className="px-3 py-2 font-medium">{r.name}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.cargo}</td>
              <td className="px-3 py-2 font-mono text-xs text-right">
                {r.salario.toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import type { Employee as DBEmployee } from '@/app/contracts/types'

function ChangeRows({ old: o, incoming: n }: { old: DBEmployee; incoming: ExcelEmployee }) {
  const fields: { key: keyof ExcelEmployee; label: string }[] = [
    { key: 'full_name', label: 'Nombre' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'salario_base', label: 'Salario' },
    { key: 'correo', label: 'Correo' },
    { key: 'jornada_laboral', label: 'Jornada' },
  ]

  const changes = fields.filter((f) => {
    const oldVal = o[f.key as keyof DBEmployee]
    const newVal = n[f.key]
    return String(oldVal ?? '') !== String(newVal ?? '')
  })

  if (changes.length === 0) return null

  return (
    <>
      {changes.map((f, i) => (
        <tr key={f.key} className="hover:bg-muted/20 transition-colors">
          {i === 0 && (
            <td
              className="px-3 py-2 font-mono text-xs text-muted-foreground align-top"
              rowSpan={changes.length}
            >
              {o.cedula}
            </td>
          )}
          <td className="px-3 py-2 text-xs text-muted-foreground">{f.label}</td>
          <td className="px-3 py-2 font-mono text-xs text-destructive/80 line-through">
            {String(o[f.key as keyof DBEmployee] ?? '—')}
          </td>
          <td className="px-3 py-2 font-mono text-xs text-emerald-400">
            {String(n[f.key] ?? '—')}
          </td>
        </tr>
      ))}
    </>
  )
}
