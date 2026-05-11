const pulse = 'rounded-md bg-muted animate-pulse'

export default function ContractsLoading() {
  return (
    <div className="px-4 py-6 sm:px-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`${pulse} h-3 w-16`} />
          <div className={`${pulse} h-7 w-40`} />
        </div>
        <div className={`${pulse} h-9 w-44`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className={`${pulse} h-9 flex-1 min-w-48`} />
        <div className={`${pulse} h-9 w-36`} />
        <div className={`${pulse} h-9 w-36`} />
        <div className={`${pulse} h-9 w-28`} />
      </div>

      {/* Case cards */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${pulse} h-3.5 w-3.5 rounded-full`} />
                <div className={`${pulse} h-4 w-24`} />
                <div className={`${pulse} h-4 w-36`} />
              </div>
              <div className={`${pulse} h-5 w-20 rounded-full`} />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="px-4 py-2.5 flex items-center gap-4">
                  <div className={`${pulse} h-4 w-32`} />
                  <div className={`${pulse} h-4 w-24`} />
                  <div className={`${pulse} h-5 w-16 rounded-full`} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
