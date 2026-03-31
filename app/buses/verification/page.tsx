import Link from 'next/link'
import { listVerificationPairs } from '@/app/buses/actions/buses'
import { ClipboardCheck } from 'lucide-react'

export default async function VerificationPage() {
  const pairs = await listVerificationPairs()

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
            <h1 className="text-xl font-semibold tracking-tight">Verificaciones</h1>
            <p className="text-sm text-muted-foreground">{pairs.length} registradas</p>
          </div>
          <Link
            href="/buses/verification/new"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nueva verificación
          </Link>
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay verificaciones registradas.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">Conductor</th>
                <th className="px-4 py-2.5 text-left">Vehículo</th>
                <th className="px-4 py-2.5 text-left">Fecha verificación</th>
                <th className="px-4 py-2.5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pairs.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.drivers?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold tracking-wider">
                    {p.vehicles?.plate ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(p.verified_at).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/buses/verification/${p.id}`}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Ver GA-F-094 →
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
