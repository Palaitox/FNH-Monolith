import Link from 'next/link'
import { listContracts } from '@/app/contracts/actions/contracts'
import { FileText, CheckSquare, Clock } from 'lucide-react'

export default async function ContractsPage() {
  const contracts = await listContracts()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">{contracts.length} en total</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/contracts/templates"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Plantillas
          </Link>
          <Link
            href="/contracts/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nuevo contrato
          </Link>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay contratos registrados.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">N° Contrato</th>
                <th className="px-4 py-2.5 text-left">Empleado</th>
                <th className="px-4 py-2.5 text-left">Tipo</th>
                <th className="px-4 py-2.5 text-left">Inicio</th>
                <th className="px-4 py-2.5 text-left">Estado</th>
                <th className="px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contracts.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{c.contract_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{c.employees?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.tipo_contrato ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.fecha_inicio ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.estado === 'signed' ? (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                        <CheckSquare className="h-3 w-3" /> Firmado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                        <Clock className="h-3 w-3" /> Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/contracts/${c.id}`}
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
