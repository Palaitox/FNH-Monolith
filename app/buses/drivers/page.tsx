import Link from 'next/link'
import { listAllDrivers } from '@/app/buses/actions/buses'
import { UserCheck, UserX } from 'lucide-react'

export default async function DriversPage() {
  const drivers = await listAllDrivers()
  const active = drivers.filter((d) => !d.deactivated_at)
  const inactive = drivers.filter((d) => d.deactivated_at)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-4">
        <Link
          href="/buses"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Buses
        </Link>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Conductores</h1>
            <p className="text-sm text-muted-foreground">
              {active.length} activos · {inactive.length} inactivos
            </p>
          </div>
          <Link
            href="/buses/drivers/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nuevo conductor
          </Link>
        </div>
      </div>

      {drivers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay conductores registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">Nombre</th>
                <th className="px-4 py-2.5 text-left">Cédula</th>
                <th className="px-4 py-2.5 text-left">Estado</th>
                <th className="px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {drivers.map((d) => (
                <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{d.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.cedula}</td>
                  <td className="px-4 py-3">
                    {d.deactivated_at ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
                        <UserX className="h-3 w-3" /> Inactivo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <UserCheck className="h-3 w-3" /> Activo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/buses/drivers/${d.id}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
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
  )
}
