'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Props {
  header: React.ReactNode
  borderClass: string
  headerBgClass: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function CollapsibleList({ header, borderClass, headerBgClass, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`rounded-lg border overflow-hidden ${borderClass}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-4 py-2.5 border-b flex items-center justify-between ${headerBgClass} ${borderClass}`}
      >
        {header}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="divide-y divide-border">{children}</div>}
    </div>
  )
}
