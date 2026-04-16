'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateEmployeeAction,
  deactivateEmployeeAction,
  reactivateEmployeeAction,
  deleteEmployeeAction,
} from '@/app/employees/actions/employees'
import type { Employee, JornadaLaboral } from '@/app/employees/types'
import type { ContractDocumentFull } from '@/app/contracts/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
const fieldClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

const JORNADA_LABELS: Record<JornadaLaboral, string> = {
  tiempo_completo: 'Tiempo completo',
  medio_tiempo: 'Medio tiempo',
  prestacion_servicios: 'Prestación de servicios',
  termino_indefinido: 'Término indefinido',
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

interface Props {
  employee: Employee
  contracts: ContractDocumentFull[]
  role: string | null
}

export default function EmployeeDetail({ employee, contracts, role }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit form state — initialized from employee prop
  const [fullName, setFullName] = useState(employee.full_name)
  const [cedula, setCedula] = useState(employee.cedula)
  const [ciudadCedula, setCiudadCedula] = useState(employee.ciudad_cedula ?? '')
  const [cargo, setCargo] = useState(employee.cargo ?? '')
  const [telefono, setTelefono] = useState(employee.telefono ?? '')
  const [correo, setCorreo] = useState(employee.correo ?? '')
  const [salarioBase, setSalarioBase] = useState(employee.salario_base?.toString() ?? '')
  const [auxilioTransporte, setAuxilioTransporte] = useState(
    employee.auxilio_transporte?.toString() ?? '0',
  )
  const [jornada, setJornada] = useState<JornadaLaboral>(employee.jornada_laboral)

  const isActive = employee.deactivated_at === null
  const isAdmin = role === 'admin'
  const isViewer = role === 'viewer'

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) { setError('El nombre es obligatorio.'); return }
    if (!cedula.trim() || isNaN(Number(cedula))) { setError('La cédula debe ser un número válido.'); return }

    startTransition(async () => {
      try {
        await updateEmployeeAction(employee.id, {
          full_name: fullName.trim().toUpperCase(),
          cedula: cedula.trim(),
          ciudad_cedula: ciudadCedula.trim() || null,
          cargo: cargo.trim() || null,
          telefono: telefono.trim() || null,
          correo: correo.trim().toLowerCase() || null,
          salario_base: salarioBase ? parseFloat(salarioBase.replace(/[^0-9.]/g, '')) : null,
          auxilio_transporte: auxilioTransporte
            ? parseFloat(auxilioTransporte.replace(/[^0-9.]/g, ''))
            : 0,
          jornada_laboral: jornada,
        })
        setEditMode(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar.')
      }
    })
  }

  function handleDeactivate() {
    startTransition(async () => {
      try {
        await deactivateEmployeeAction(employee.id)
        router.refresh()
        setConfirmDeactivate(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al desactivar.')
      }
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateEmployeeAction(employee.id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al reactivar.')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteEmployeeAction(employee.id)
        router.push('/employees')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar.')
        setConfirmDelete(false)
      }
    })
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/employees"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Empleados
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-semibold tracking-tight">{employee.full_name}</h1>
            {!isActive && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-mono text-amber-400">
                Inactivo
              </span>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground mt-0.5">
            CC {employee.cedula}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!editMode && isActive && !isViewer && (
            <button
              onClick={() => setEditMode(true)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editMode ? (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <p className={labelClass}>Datos personales</p>

            <div className="space-y-1.5">
              <label className={labelClass}>Nombre completo *</label>
              <input className={fieldClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Cédula *</label>
                <input className={`${fieldClass} font-mono`} value={cedula} onChange={(e) => setCedula(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Ciudad expedición cédula</label>
                <input className={fieldClass} value={ciudadCedula} onChange={(e) => setCiudadCedula(e.target.value)} placeholder="Ej. Buga (Valle del Cauca)" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Cargo</label>
              <input className={fieldClass} value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Teléfono</label>
                <input className={`${fieldClass} font-mono`} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Correo</label>
                <input type="email" className={fieldClass} value={correo} onChange={(e) => setCorreo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <p className={labelClass}>Condiciones laborales</p>
            <div className="space-y-1.5">
              <label className={labelClass}>Jornada laboral</label>
              <select className={fieldClass} value={jornada} onChange={(e) => setJornada(e.target.value as JornadaLaboral)}>
                <option value="tiempo_completo">Tiempo completo</option>
                <option value="medio_tiempo">Medio tiempo</option>
                <option value="prestacion_servicios">Prestación de servicios</option>
                <option value="termino_indefinido">Término indefinido</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Salario base (COP)</label>
                <input className={`${fieldClass} font-mono`} value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} inputMode="numeric" />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Auxilio de transporte (COP)</label>
                <input className={`${fieldClass} font-mono`} value={auxilioTransporte} onChange={(e) => setAuxilioTransporte(e.target.value)} inputMode="numeric" />
              </div>
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => { setEditMode(false); setError(null) }} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      ) : (
        /* Read-only view */
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {[
            { label: 'Ciudad expedición CC', value: employee.ciudad_cedula ?? '—' },
            { label: 'Cargo', value: employee.cargo ?? '—' },
            { label: 'Jornada', value: JORNADA_LABELS[employee.jornada_laboral], mono: true },
            { label: 'Salario base', value: formatCOP(employee.salario_base), mono: true },
            { label: 'Auxilio de transporte', value: formatCOP(employee.auxilio_transporte), mono: true },
            { label: 'Teléfono', value: employee.telefono ?? '—', mono: true },
            { label: 'Correo', value: employee.correo ?? '—' },
            {
              label: 'Registrado',
              value: new Date(employee.created_at).toLocaleDateString('es-CO'),
              mono: true,
            },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center px-5 py-3 gap-0.5 sm:gap-4">
              <span className={`sm:w-44 sm:shrink-0 ${labelClass}`}>{label}</span>
              <span className={`text-sm ${mono ? 'font-mono' : ''}`}>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Contracts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className={labelClass}>Contratos ({contracts.length})</p>
          {contracts.length > 0 && (
            <Link href="/contracts" className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Ver todos →
            </Link>
          )}
        </div>

        {contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin contratos registrados.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>N°</th>
                  <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>Tipo</th>
                  <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>Inicio</th>
                  <th className={`px-4 py-2.5 text-left ${labelClass}`}>Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contracts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">
                      {c.contract_cases?.case_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {c.document_type === 'INICIAL' ? (c.tipo_contrato ?? '—') : c.document_type}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground hidden sm:table-cell">
                      {c.fecha_inicio ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${
                        c.estado === 'signed'
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                      }`}>
                        {c.estado === 'signed' ? 'Firmado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/contracts/${c.id}`}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger zone — hidden for viewers */}
      {!isViewer && <div className="rounded-lg border border-destructive/30 p-5 space-y-4">
        <p className={labelClass}>Zona peligrosa</p>

        {error && !editMode && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {isActive ? (
            confirmDeactivate ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">¿Confirmar desactivación?</span>
                <button
                  onClick={handleDeactivate}
                  disabled={isPending}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? 'Desactivando…' : 'Sí, desactivar'}
                </button>
                <button
                  onClick={() => setConfirmDeactivate(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                Desactivar empleado
              </button>
            )
          ) : (
            <button
              onClick={handleReactivate}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Reactivando…' : 'Reactivar empleado'}
            </button>
          )}

          {isAdmin && contracts.length === 0 && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">¿Eliminar permanentemente?</span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                Eliminar permanentemente
              </button>
            )
          )}
        </div>

        {isAdmin && contracts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            La eliminación permanente no está disponible: el empleado tiene {contracts.length} contrato{contracts.length !== 1 ? 's' : ''} registrado{contracts.length !== 1 ? 's' : ''}. Desactívalo en su lugar.
          </p>
        )}
      </div>}

      <div>
        <Link
          href="/employees"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          ← Volver
        </Link>
      </div>
    </main>
  )
}
