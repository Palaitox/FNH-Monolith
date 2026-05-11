const pulse = 'rounded-md bg-muted animate-pulse'

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className={`${pulse} h-3 w-24`} />
      <div className={`${pulse} h-7 w-12`} />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1.5">
        <div className={`${pulse} h-6 w-40`} />
        <div className={`${pulse} h-4 w-56`} />
      </div>

      {/* Contracts section */}
      <div className="space-y-3">
        <div className={`${pulse} h-4 w-24`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>

      {/* Employee status section */}
      <div className="space-y-3">
        <div className={`${pulse} h-4 w-48`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>

      {/* Fleet section */}
      <div className="space-y-3">
        <div className={`${pulse} h-4 w-36`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
