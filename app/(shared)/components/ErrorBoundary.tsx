'use client'

import Link from 'next/link'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
  backHref: string
  backLabel: string
}

export function ErrorBoundary({ error, reset, backHref, backLabel }: Props) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
      <h2 className="text-lg font-semibold">Ocurrió un error</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || 'Error inesperado. Intenta de nuevo o vuelve al módulo.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground/60">ref: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Reintentar
        </button>
        <Link
          href={backHref}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
