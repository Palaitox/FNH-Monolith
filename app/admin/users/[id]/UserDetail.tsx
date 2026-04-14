'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  updateRoleAction,
  deactivateUserAction,
  reactivateUserAction,
  deleteUserAction,
} from '@/app/admin/actions/users'
import { ROLE_LABELS, ROLE_COLORS } from '@/app/admin/types'
import type { AppUser, AppUserRole } from '@/app/admin/types'

const labelClass = 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
const fieldClass =
  'w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'

interface Props {
  user: AppUser
  currentUserId: string | null
}

export default function UserDetail({ user, currentUserId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [editRole, setEditRole] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AppUserRole>(user.role)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isActive = user.deactivated_at === null
  const isSelf = currentUserId === user.id

  // Sync selectedRole when server refreshes user data
  useEffect(() => {
    setSelectedRole(user.role)
  }, [user.role])

  function handleRoleSave() {
    setError(null)
    startTransition(async () => {
      try {
        await updateRoleAction(user.id, selectedRole)
        setEditRole(false)
        router.push(`/admin/users/${user.id}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al actualizar el rol.')
      }
    })
  }

  function handleDeactivate() {
    startTransition(async () => {
      try {
        await deactivateUserAction(user.id)
        router.refresh()
        setConfirmDeactivate(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al desactivar.')
      }
    })
  }

  function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateUserAction(user.id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al reactivar.')
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteUserAction(user.id)
        router.push('/admin')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar el usuario.')
        setConfirmDelete(false)
      }
    })
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Usuarios
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          {!isActive && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-mono text-amber-400">
              Desactivado
            </span>
          )}
          {isSelf && (
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Tú
            </span>
          )}
        </div>
        {user.email && (
          <p className="font-mono text-sm text-muted-foreground mt-0.5">{user.email}</p>
        )}
      </div>

      {/* Details card */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {/* Role row */}
        <div className="flex items-center justify-between px-5 py-3 gap-4">
          <span className={`w-44 shrink-0 ${labelClass}`}>Rol</span>
          {editRole ? (
            <div className="flex items-center gap-2 flex-1">
              <select
                className={`${fieldClass} flex-1`}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AppUserRole)}
              >
                {(Object.entries(ROLE_LABELS) as [AppUserRole, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                onClick={handleRoleSave}
                disabled={isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isPending ? '…' : 'Guardar'}
              </button>
              <button
                onClick={() => { setEditRole(false); setSelectedRole(user.role) }}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between flex-1">
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${ROLE_COLORS[user.role]}`}>
                {ROLE_LABELS[user.role]}
              </span>
              {isActive && !isSelf && (
                <button
                  onClick={() => setEditRole(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cambiar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Estado row */}
        <div className="flex items-center px-5 py-3 gap-4">
          <span className={`w-44 shrink-0 ${labelClass}`}>Estado</span>
          <span className={`text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
            {isActive ? 'Activo' : `Desactivado el ${new Date(user.deactivated_at!).toLocaleDateString('es-CO')}`}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Danger zone — only shown for other users */}
      {!isSelf && (
        <div className="rounded-lg border border-destructive/30 p-5 space-y-4">
          <p className={labelClass}>Zona peligrosa</p>

          {isActive ? (
            confirmDeactivate ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  El usuario perderá acceso de inmediato. ¿Continuar?
                </span>
                <button
                  onClick={handleDeactivate}
                  disabled={isPending}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? 'Desactivando…' : 'Sí, desactivar'}
                </button>
                <button
                  onClick={() => setConfirmDeactivate(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeactivate(true)}
                className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                Desactivar usuario
              </button>
            )
          ) : (
            <button
              onClick={handleReactivate}
              disabled={isPending}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Reactivando…' : 'Reactivar usuario'}
            </button>
          )}

          <div className="border-t border-destructive/20 pt-4">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Esto elimina la cuenta permanentemente. ¿Continuar?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isPending ? 'Eliminando…' : 'Sí, eliminar'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded-md border border-destructive px-3 py-1.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
              >
                Eliminar usuario
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
