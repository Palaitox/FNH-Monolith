import Link from 'next/link'
import { listVehicles } from '@/app/buses/actions/buses'
import { Bus } from 'lucide-react'

export default async function VehiclesPage() {
  const vehicles = await listVehicles()

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
            <h1 className="text-xl font-semibold tracking-tight">Vehículos</h1>
            <p className="text-sm text-muted-foreground">{vehicles.length} activos</p>
          </div>
          <Link
            href="/buses/vehicles/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nuevo vehículo
          </Link>
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Bus className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay vehículos registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">Placa</th>
                <th className="px-4 py-2.5 text-left">Tipo</th>
                <th className="px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">{v.plate}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{v.type}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/buses/vehicles/${v.id}`}
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
