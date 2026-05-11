const pulse = 'rounded-md bg-muted animate-pulse'

export default function EmployeesLoading() {
  return (
    <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`${pulse} h-3 w-16`} />
          <div className={`${pulse} h-7 w-32`} />
        </div>
        <div className={`${pulse} h-9 w-36`} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className={`${pulse} h-3 w-20`} />
            <div className={`${pulse} h-7 w-10`} />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className={`${pulse} h-9 flex-1`} />
        <div className={`${pulse} h-9 w-40`} />
        <div className={`${pulse} h-9 w-28`} />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted/40 px-4 py-2.5 border-b border-border">
          <div className={`${pulse} h-3 w-48`} />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-4">
              <div className={`${pulse} h-4 w-48`} />
              <div className={`${pulse} h-4 w-24 hidden sm:block`} />
              <div className={`${pulse} h-4 w-32 hidden sm:block flex-1`} />
              <div className={`${pulse} h-5 w-20 rounded-full`} />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
