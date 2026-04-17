import Link from 'next/link'
import { getDashboardStats, getEmployeeContractStatusAction } from '@/app/contracts/actions/contracts'
import { getFleetComplianceAction } from '@/app/buses/actions/buses'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { StatusBadge } from '@/app/buses/components/StatusBadge'
import { FileText, Users, CheckSquare, Clock, Bus, AlertTriangle, UserCheck, BedDouble } from 'lucide-react'
import type { DocumentStatus } from '@/app/buses/types'

const STATUS_ORDER: DocumentStatus[] = ['Crítico', 'Alerta', 'Seguimiento', 'Vigente']

const STATUS_RING: Record<DocumentStatus, string> = {
  Vigente:     'border-green-500 bg-green-500',
  Seguimiento: 'border-blue-500 bg-blue-500',
  Alerta:      'border-amber-500 bg-amber-500',
  Crítico:     'border-red-500 bg-red-500',
}

const STATUS_CARD: Record<DocumentStatus, string> = {
  Vigente:     'border-green-500/30 bg-green-900/10',
  Seguimiento: 'border-blue-500/30 bg-blue-900/10',
  Alerta:      'border-amber-500/30 bg-amber-900/10',
  Crítico:     'border-red-500/30 bg-red-900/10',
}

const STATUS_NUM: Record<DocumentStatus, string> = {
  Vigente:     'text-green-400',
  Seguimiento: 'text-blue-400',
  Alerta:      'text-amber-400',
  Crítico:     'text-red-400',
}

export default async function DashboardPage() {
  const [stats, fleet, role, contractStatus] = await Promise.all([
    getDashboardStats(),
    getFleetComplianceAction(),
    getUserRole(),
    getEmployeeContractStatusAction(),
  ])

  const contractCards = [
    { label: 'Empleados', value: stats.totalEmployees, icon: Users },
    { label: 'Contratos totales', value: stats.totalContracts, icon: FileText },
    { label: 'Firmados', value: stats.contractsSigned, icon: CheckSquare },
    { label: 'Pendientes', value: stats.contractsPending, icon: Clock },
  ]

  return (
    <div className="px-4 py-6 sm:px-6 space-y-8 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Panel de control</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Rol: <span className="font-medium">{role ?? '—'}</span>
          {' · '}
          {stats.contractsThisMonth} contrato{stats.contractsThisMonth !== 1 ? 's' : ''} este mes
        </p>
      </div>

      {/* ── Contracts ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Contratos
          </h2>
          <Link
            href="/contracts"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {contractCards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-2xl font-mono font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Employee contract status ─────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            Estado contractual de empleados
          </h2>
          <Link href="/contracts" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Ver contratos →
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={`rounded-lg border p-4 ${contractStatus.sinContrato.length > 0 ? 'border-rose-500/30 bg-rose-900/10' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2 mb-2">
              {contractStatus.sinContrato.length > 0
                ? <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                : <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">Sin contrato vigente</span>
            </div>
            <p className={`text-2xl font-mono font-semibold ${contractStatus.sinContrato.length > 0 ? 'text-rose-400' : ''}`}>
              {contractStatus.sinContrato.length}
            </p>
          </div>
          <div className={`rounded-lg border p-4 ${contractStatus.pendienteFirma.length > 0 ? 'border-amber-500/30 bg-amber-900/10' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`h-3.5 w-3.5 ${contractStatus.pendienteFirma.length > 0 ? 'text-amber-400' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">Pendientes de firma</span>
            </div>
            <p className={`text-2xl font-mono font-semibold ${contractStatus.pendienteFirma.length > 0 ? 'text-amber-400' : ''}`}>
              {contractStatus.pendienteFirma.length}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-900/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-muted-foreground">Con contrato vigente</span>
            </div>
            <p className="text-2xl font-mono font-semibold text-emerald-400">
              {contractStatus.vigentes.length}
            </p>
          </div>
          <div className={`rounded-lg border p-4 ${contractStatus.enLicencia.length > 0 ? 'border-violet-500/30 bg-violet-900/10' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2 mb-2">
              <BedDouble className={`h-3.5 w-3.5 ${contractStatus.enLicencia.length > 0 ? 'text-violet-400' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">En licencia</span>
            </div>
            <p className={`text-2xl font-mono font-semibold ${contractStatus.enLicencia.length > 0 ? 'text-violet-400' : ''}`}>
              {contractStatus.enLicencia.length}
            </p>
          </div>
        </div>

        {/* Sin contrato — most urgent */}
        {contractStatus.sinContrato.length > 0 && (
          <div className="rounded-lg border border-rose-500/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-rose-900/10 border-b border-rose-500/20">
              <p className="text-xs font-medium text-rose-400 uppercase tracking-wide">
                Sin contrato vigente ({contractStatus.sinContrato.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {contractStatus.sinContrato.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/employees/${emp.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                >
                  <span className="text-sm font-medium">{emp.full_name}</span>
                  <span className="text-xs text-muted-foreground hover:text-primary transition-colors">Ver →</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Pendientes de firma */}
        {contractStatus.pendienteFirma.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-amber-900/10 border-b border-amber-500/20">
              <p className="text-xs font-medium text-amber-400 uppercase tracking-wide">
                Pendientes de firma ({contractStatus.pendienteFirma.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {contractStatus.pendienteFirma.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/contracts?search=${encodeURIComponent(emp.full_name)}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                >
                  <span className="text-sm font-medium">{emp.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {emp.caseNumber ?? '—'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* En licencia */}
        {contractStatus.enLicencia.length > 0 && (
          <div className="rounded-lg border border-violet-500/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-violet-900/10 border-b border-violet-500/20">
              <p className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                En licencia ({contractStatus.enLicencia.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {contractStatus.enLicencia.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/employees/${emp.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
                >
                  <span className="text-sm font-medium">{emp.full_name}</span>
                  <span className="text-xs text-muted-foreground hover:text-primary transition-colors">Ver →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Fleet compliance ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Bus className="h-3.5 w-3.5" />
            Cumplimiento flotilla
          </h2>
          <Link
            href="/buses"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver módulo →
          </Link>
        </div>

        {/* Status count cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const count = fleet.entityCounts[status]
            return (
              <div
                key={status}
                className={`rounded-lg border p-4 ${STATUS_CARD[status]}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_RING[status]}`} />
                  <span className="text-xs text-muted-foreground">{status}</span>
                </div>
                <p className={`text-2xl font-mono font-semibold ${STATUS_NUM[status]}`}>
                  {count}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {count === 1 ? 'entidad' : 'entidades'}
                </p>
              </div>
            )
          })}
        </div>

        {/* Needs attention list */}
        {fleet.needsAttention.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/40 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Requieren atención ({fleet.needsAttention.length})
              </p>
            </div>
            <div className="divide-y divide-border">
              {fleet.needsAttention.map((entity) => (
                <Link
                  key={entity.id}
                  href={entity.href}
                  className="flex items-start justify-between px-4 py-3 hover:bg-muted/20 transition-colors group"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono group-hover:text-primary transition-colors truncate">
                        {entity.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {entity.entity_type === 'driver' ? 'Conductor' : 'Vehículo'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {[
                        entity.urgentDocs.join(' · '),
                        entity.missingCount > 0
                          ? `${entity.missingCount} doc${entity.missingCount !== 1 ? 's' : ''} sin registrar`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Sin información de documentos'}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0">
                    <StatusBadge status={entity.overall} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : fleet.totalEntities > 0 ? (
          <div className="rounded-lg border border-green-500/30 bg-green-900/10 px-4 py-3">
            <p className="text-sm text-green-400">
              Todas las entidades activas están en cumplimiento.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              No hay conductores ni vehículos activos registrados.
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          {fleet.totalEntities} entidades · calculado {new Date(fleet.lastComputedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </section>
    </div>
  )
}
