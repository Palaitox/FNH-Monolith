'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { inviteUserAction } from '@/app/admin/actions/users'
import { ROLE_LABELS } from '@/app/admin/types'
import type { AppUserRole } from '@/app/admin/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
const fieldClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

export default function InviteUserPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AppUserRole>('coordinator')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        await inviteUserAction({ name, email, role })
        router.push('/admin')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al enviar la invitación.')
      }
    })
  }

  return (
    <main className="max-w-lg mx-auto p-6 space-y-8">
      <div>
        <Link
          href="/admin"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Usuarios
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Invitar usuario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Se enviará un correo de configuración a la dirección indicada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="space-y-1.5">
            <label className={labelClass}>Nombre completo *</label>
            <input
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NOMBRE APELLIDO"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Correo electrónico *</label>
            <input
              type="email"
              className={`${fieldClass} font-mono`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Rol *</label>
            <select
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as AppUserRole)}
            >
              {(Object.entries(ROLE_LABELS) as [AppUserRole, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {role === 'coordinator' && 'Puede crear y editar contratos, empleados y buses. No puede gestionar usuarios.'}
              {role === 'viewer' && 'Solo puede consultar. No puede crear ni modificar ningún dato.'}
              {role === 'admin' && 'Acceso total, incluyendo gestión de usuarios.'}
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/admin"
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isPending ? 'Enviando invitación…' : 'Enviar invitación'}
          </button>
        </div>
      </form>
    </main>
  )
}
