'use client'

import { ErrorBoundary } from '@/app/(shared)/components/ErrorBoundary'

export default function BusesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorBoundary error={error} reset={reset} backHref="/buses" backLabel="← Módulo de buses" />
}
