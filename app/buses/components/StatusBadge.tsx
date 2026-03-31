import type { DocumentStatus } from '@/app/buses/types'

const STYLES: Record<DocumentStatus, string> = {
  Vigente:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Seguimiento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Alerta:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Crítico:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  )
}
