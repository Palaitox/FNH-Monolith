'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { listAllEmployees } from '@/app/employees/actions/employees'
import type { Employee, JornadaLaboral } from '@/app/employees/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

const JORNADA_LABELS: Record<JornadaLaboral, string> = {
  tiempo_completo: 'Tiempo completo',
  medio_tiempo: 'Medio tiempo',
  prestacion_servicios: 'Prestación',
}

const JORNADA_COLORS: Record<JornadaLaboral, string> = {
  tiempo_completo: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  medio_tiempo: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  prestacion_servicios: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
}

function formatCOP(value: number | null): string {
  if (value === null || value === 0) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [jornadaFilter, setJornadaFilter] = useState<JornadaLaboral | ''>('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    listAllEmployees().then((data) => {
      setEmployees(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return employees.filter((e) => {
      const active = e.deactivated_at === null
      if (!showInactive && !active) return false
      if (showInactive && active) return false
      if (jornadaFilter && e.jornada_laboral !== jornadaFilter) return false
      if (!term) return true
      return (
        e.full_name.toLowerCase().includes(term) ||
        e.cedula.includes(term) ||
        (e.cargo ?? '').toLowerCase().includes(term)
      )
    })
  }, [employees, search, jornadaFilter, showInactive])

  const active = employees.filter((e) => e.deactivated_at === null)
  const inactive = employees.filter((e) => e.deactivated_at !== null)
  const byJornada = (j: JornadaLaboral) =>
    active.filter((e) => e.jornada_laboral === j).length

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className={labelClass}>Módulo</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Empleados</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/employees/import"
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Importar Excel
          </Link>
          <Link
            href="/employees/new"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            + Nuevo empleado
          </Link>
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Activos', value: active.length },
            { label: 'Tiempo completo', value: byJornada('tiempo_completo') },
            { label: 'Medio tiempo', value: byJornada('medio_tiempo') },
            { label: 'Prestación', value: byJornada('prestacion_servicios') },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <p className={labelClass}>{label}</p>
              <p className="text-2xl font-semibold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, cédula o cargo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={jornadaFilter}
          onChange={(e) => setJornadaFilter(e.target.value as JornadaLaboral | '')}
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Todas las jornadas</option>
          <option value="tiempo_completo">Tiempo completo</option>
          <option value="medio_tiempo">Medio tiempo</option>
          <option value="prestacion_servicios">Prestación de servicios</option>
        </select>
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
            showInactive
              ? 'border-amber-400/40 text-amber-400 bg-amber-400/10'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          {showInactive ? 'Viendo inactivos' : 'Ver inactivos'}{inactive.length > 0 ? ` (${inactive.length})` : ''}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Nombre</th>
              <th className={`px-4 py-2.5 text-left ${labelClass} font-mono hidden sm:table-cell`}>Cédula</th>
              <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>Cargo</th>
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Jornada</th>
              <th className={`px-4 py-2.5 text-right ${labelClass} hidden sm:table-cell`}>Salario base</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  {search || jornadaFilter ? 'Sin resultados para ese filtro.' : showInactive ? 'No hay empleados inactivos.' : 'No hay empleados activos.'}
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{e.full_name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">{e.cedula}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.cargo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${JORNADA_COLORS[e.jornada_laboral]}`}
                    >
                      {JORNADA_LABELS[e.jornada_laboral]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden sm:table-cell">
                    {formatCOP(e.salario_base)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/employees/${e.id}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
