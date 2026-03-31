import Link from 'next/link'
import { getDashboardStats } from '@/app/contracts/actions/contracts'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { FileText, Users, CheckSquare, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const [stats, role] = await Promise.all([getDashboardStats(), getUserRole()])

  const cards = [
    { label: 'Empleados', value: stats.totalEmployees, icon: Users },
    { label: 'Contratos totales', value: stats.totalContracts, icon: FileText },
    { label: 'Firmados', value: stats.contractsSigned, icon: CheckSquare },
    { label: 'Pendientes', value: stats.contractsPending, icon: Clock },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel de control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rol: <span className="font-medium">{role ?? '—'}</span>
          {' · '}
          {stats.contractsThisMonth} contrato{stats.contractsThisMonth !== 1 ? 's' : ''} este mes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Icon className="h-4 w-4" />
              <span className="text-xs">{label}</span>
            </div>
            <p className="text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href="/contracts"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          Ver contratos
        </Link>
      </div>
    </div>
  )
}
