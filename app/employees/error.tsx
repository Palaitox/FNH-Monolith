'use client'

import { ErrorBoundary } from '@/app/(shared)/components/ErrorBoundary'

export default function EmployeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorBoundary error={error} reset={reset} backHref="/employees" backLabel="← Empleados" />
}
