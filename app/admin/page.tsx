import Link from 'next/link'
import { listUsersAction } from '@/app/admin/actions/users'
import { ROLE_LABELS, ROLE_COLORS } from '@/app/admin/types'
import type { AppUser } from '@/app/admin/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'

function RoleChip({ role }: { role: AppUser['role'] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  )
}

export default async function AdminPage() {
  const users = await listUsersAction()
  const active = users.filter((u) => u.deactivated_at === null)
  const inactive = users.filter((u) => u.deactivated_at !== null)

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
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
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Activos', value: active.length },
          { label: 'Coordinadores', value: active.filter((u) => u.role === 'coordinator').length },
          { label: 'Consultores', value: active.filter((u) => u.role === 'viewer').length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <p className={labelClass}>{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Active users */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Nombre</th>
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Correo</th>
              <th className={`px-4 py-2.5 text-left ${labelClass}`}>Rol</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {active.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No hay usuarios activos.
                </td>
              </tr>
            ) : (
              active.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{u.email ?? '—'}</td>
                  <td className="px-4 py-3"><RoleChip role={u.role} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${u.id}`}
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

      {/* Inactive users (collapsed) */}
      {inactive.length > 0 && (
        <div className="space-y-3">
          <p className={`${labelClass} text-amber-400/70`}>Desactivados ({inactive.length})</p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {inactive.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/20 transition-colors opacity-60">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-xs">{u.email ?? '—'}</td>
                    <td className="px-4 py-3"><RoleChip role={u.role} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
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
        </div>
      )}
    </main>
  )
}
