import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { listUsersAction } from '@/app/admin/actions/users'
import { ROLE_LABELS, ROLE_COLORS } from '@/app/admin/types'
import type { AppUser, ManagementRole } from '@/app/admin/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

function RoleChip({ role }: { role: ManagementRole }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

function WorkerStatusChip({ confirmed, deactivated }: { confirmed: boolean; deactivated: boolean }) {
  if (deactivated) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/20 px-2 py-0.5 font-mono text-xs text-muted-foreground">
        Desactivado
      </span>
    )
  }
  if (confirmed) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs text-emerald-400">
        Activo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-400">
      Inv. pendiente
    </span>
  )
}

export default async function AdminPage() {
  const users = await listUsersAction()

  const mgmtUsers = users.filter((u) => u.role !== 'worker')
  const workerUsers = users.filter((u) => u.role === 'worker')

  const mgmtActive = mgmtUsers.filter((u) => u.deactivated_at === null)
  const mgmtInactive = mgmtUsers.filter((u) => u.deactivated_at !== null)
  const workersActive = workerUsers.filter((u) => u.deactivated_at === null)

  return (
    <main className="max-w-4xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className={labelClass}>Módulo</p>
          <h1 className="text-2xl font-semibold tracking-tight mt-0.5">Usuarios</h1>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          + Invitar usuario
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activos', value: mgmtActive.length },
          { label: 'Coordinadores', value: mgmtActive.filter((u) => u.role === 'coordinator').length },
          { label: 'Consultores', value: mgmtActive.filter((u) => u.role === 'viewer').length },
          { label: 'Workers activos', value: workersActive.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className={labelClass}>{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Management users table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Nombre</th>
              <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>Correo</th>
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Rol</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mgmtActive.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No hay usuarios activos.
                </td>
              </tr>
            ) : (
              mgmtActive.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs hidden sm:table-cell">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <RoleChip role={u.role as ManagementRole} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Workers section — collapsible */}
      {workerUsers.length > 0 && (
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted/20 transition-colors">
            <span className={`${labelClass} text-amber-400/80`}>
              Workers ({workerUsers.length})
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-2 rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className={`px-4 py-2.5 text-left ${labelClass}`}>Nombre</th>
                  <th className={`px-4 py-2.5 text-left ${labelClass} hidden sm:table-cell`}>Correo</th>
                  <th className={`px-4 py-2.5 text-left ${labelClass}`}>Estado</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {workerUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={`hover:bg-muted/20 transition-colors ${u.deactivated_at ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs hidden sm:table-cell">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <WorkerStatusChip
                        confirmed={u.invite_confirmed ?? false}
                        deactivated={u.deactivated_at !== null}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${u.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Inactive management users */}
      {mgmtInactive.length > 0 && (
        <div className="space-y-3">
          <p className={`${labelClass} text-amber-400/70`}>Desactivados ({mgmtInactive.length})</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {mgmtInactive.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors opacity-60">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs hidden sm:table-cell">{u.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <RoleChip role={u.role as ManagementRole} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/users/${u.id}`} className="text-muted-foreground hover:text-primary transition-colors">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}
