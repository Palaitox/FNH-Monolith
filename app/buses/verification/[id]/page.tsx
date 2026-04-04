import { notFound } from 'next/navigation'
import Link from 'next/link'
import { generateReportAction } from '@/app/buses/actions/buses'
import { StatusBadge } from '@/app/buses/components/StatusBadge'
import type { GA_F_094_DocumentRow } from '@/app/buses/types'

interface Props {
  params: Promise<{ id: string }>
}

const labelClass = "text-xs font-medium uppercase tracking-wide text-muted-foreground"
const btnSecondary = "rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"

export default async function VerificationReportPage({ params }: Props) {
  const { id } = await params
  const report = await generateReportAction(id)

  if (!report) notFound()

  const verifiedDate = new Date(report.verified_at).toLocaleDateString('es-CO', {
    dateStyle: 'long',
  })

  return (
    <div className="px-4 py-6 sm:px-6 max-w-4xl mx-auto space-y-8">

      {/* Report header */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-mono text-xs text-muted-foreground">GA-F-094</p>
            <h1 className="text-xl font-semibold tracking-tight">Verificación documental</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground pt-1">
            {new Date(report.generated_at).toLocaleString('es-CO')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-1">
          <div className="space-y-1">
            <p className={labelClass}>Conductor</p>
            <p className="font-medium">{report.driver.full_name}</p>
            <p className="font-mono text-xs text-muted-foreground">{report.driver.cedula}</p>
          </div>
          <div className="space-y-1">
            <p className={labelClass}>Vehículo</p>
            <p className="font-mono font-semibold tracking-wider">{report.vehicle.plate}</p>
            <p className="text-xs text-muted-foreground capitalize">{report.vehicle.type}</p>
          </div>
          <div className="space-y-1">
            <p className={labelClass}>Fecha verificación</p>
            <p className="font-medium">{verifiedDate}</p>
          </div>
        </div>
      </div>

      <DocumentSection
        title="Documentos del conductor"
        rows={report.driver_documents}
        emptyMessage="No hay eventos documentales para este conductor en la fecha de verificación."
      />

      <DocumentSection
        title="Documentos del vehículo"
        rows={report.vehicle_documents}
        emptyMessage="No hay eventos documentales para este vehículo en la fecha de verificación."
      />

      <div className="flex gap-2 flex-wrap">
        <Link href="/buses/verification" className={btnSecondary}>← Volver</Link>
        <Link href={`/buses/drivers/${report.driver.id}`} className={btnSecondary}>
          Ver conductor
        </Link>
        <Link href={`/buses/vehicles/${report.vehicle.id}`} className={btnSecondary}>
          Ver vehículo
        </Link>
      </div>
    </div>
  )
}

function DocumentSection({
  title,
  rows,
  emptyMessage,
}: {
  title: string
  rows: GA_F_094_DocumentRow[]
  emptyMessage: string
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.requirement_id} className="border-b border-border/60 last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    {row.requirement_name}
                    {row.is_illegible && (
                      <span className="ml-2 font-mono text-xs text-amber-500">(ilegible)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {row.expiry_date ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.computed_status} />
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
