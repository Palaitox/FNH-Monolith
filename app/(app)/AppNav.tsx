'use client'

import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/client'
import { useRouter } from 'next/navigation'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/contracts', label: 'Contratos' },
  { href: '/employees', label: 'Empleados' },
  { href: '/buses', label: 'Buses' },
]

interface Props {
  role: string | null
}

export default function AppNav({ role }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center gap-6 px-6">
        <span className="text-sm font-semibold tracking-tight shrink-0">FNH</span>

        <nav className="flex items-center gap-1 flex-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <a
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {label}
              </a>
            )
          })}
        </nav>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {role && <span className="capitalize">{role}</span>}
          <button
            onClick={handleSignOut}
            className="hover:text-foreground transition-colors"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}
