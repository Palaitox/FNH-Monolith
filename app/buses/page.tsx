import Link from 'next/link'
import { listDrivers, listVehicles, listVerificationPairs } from '@/app/buses/actions/buses'
import { Bus, Users, ClipboardCheck } from 'lucide-react'

export default async function BusesPage() {
  const [drivers, vehicles, pairs] = await Promise.all([
    listDrivers(),
    listVehicles(),
    listVerificationPairs(),
  ])

  const cards = [
    { label: 'Conductores activos', value: drivers.length, icon: Users, href: '/buses/drivers' },
    { label: 'Vehículos activos', value: vehicles.length, icon: Bus, href: '/buses/vehicles' },
    { label: 'Verificaciones', value: pairs.length, icon: ClipboardCheck, href: '/buses/verification' },
  ]

  return (
    <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-8">
      <div className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Buses</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de conductores, vehículos y verificación documental
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm transition-all group"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="font-mono text-3xl font-semibold group-hover:text-primary transition-colors">
                {value}
              </p>
              <span className="text-muted-foreground/40 group-hover:text-primary transition-colors text-lg leading-none pb-0.5">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
