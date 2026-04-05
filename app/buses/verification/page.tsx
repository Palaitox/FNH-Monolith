import Link from 'next/link'
import { listVerificationPairs } from '@/app/buses/actions/buses'
import { getUserRole } from '@/app/(shared)/lib/auth'
import { ClipboardCheck } from 'lucide-react'

export default async function VerificationPage() {
  const [pairs, role] = await Promise.all([listVerificationPairs(), getUserRole()])

  return (
    <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-4">
        <Link
          href="/buses"
          className="inline-flex rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          ← Volver
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-xl font-semibold tracking-tight">Verificaciones</h1>
            <p className="text-sm text-muted-foreground">{pairs.length} registradas</p>
          </div>
          {role !== 'viewer' && (
            <Link
              href="/buses/verification/new"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              + Nueva verificación
            </Link>
          )}
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No hay verificaciones registradas.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                <th className="px-4 py-2.5 text-left">Conductor</th>
                <th className="px-4 py-2.5 text-left">Vehículo</th>
                <th className="px-4 py-2.5 text-left hidden sm:table-cell">Fecha verificación</th>
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
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
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
