'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Panel' },
  { href: '/contracts', label: 'Contratos' },
  { href: '/employees', label: 'Empleados' },
  { href: '/buses', label: 'Buses' },
]

const ADMIN_LINK = { href: '/admin', label: 'Admin' }

interface Props {
  role: string | null
}

export default function AppNav({ role }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  function toggleTheme() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const links = [...NAV_LINKS, ...(role === 'admin' ? [ADMIN_LINK] : [])]

  function linkClass(href: string) {
    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    return active
      ? 'rounded-md px-3 py-1.5 text-sm transition-colors bg-muted font-medium text-foreground'
      : 'rounded-md px-3 py-1.5 text-sm transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50'
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight shrink-0">
          FNH
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              {label}
            </Link>
          ))}
        </nav>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground ml-auto">
          {role && <span className="capitalize">{role}</span>}
          <button
            onClick={toggleTheme}
            className="hover:text-foreground transition-colors"
            title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {isDark ? '☀' : '☾'}
          </button>
          <button onClick={handleSignOut} className="hover:text-foreground transition-colors">
            Salir
          </button>
        </div>

        {/* Mobile spacer + hamburger */}
        <div className="flex-1 md:hidden" />
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden border-t border-border bg-background">
          <div className="flex flex-col px-4 py-3 gap-1">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClass(href)}>
                {label}
              </Link>
            ))}
            <div className="flex items-center gap-4 px-3 pt-3 mt-2 border-t border-border text-sm text-muted-foreground">
              {role && <span className="capitalize flex-1">{role}</span>}
              <button
                onClick={toggleTheme}
                className="hover:text-foreground transition-colors"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? '☀' : '☾'}
              </button>
              <button onClick={handleSignOut} className="hover:text-foreground transition-colors">
                Salir
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
