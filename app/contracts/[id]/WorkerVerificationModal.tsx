'use client'

import { useState } from 'react'
import { X, ShieldCheck } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

interface Props {
  workerName: string
  workerEmail: string
  onVerified: (userId: string, email: string) => void
  onClose: () => void
}

// In-memory storage — credentials are never written to disk or cookies.
// The coordinator's cookie-based session is completely unaffected.
function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value) },
    removeItem: (key: string) => { store.delete(key) },
  }
}

export default function WorkerVerificationModal({ workerName, workerEmail, onVerified, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleVerify() {
    if (!password) return
    setVerifying(true)
    setError(null)

    try {
      // Create an isolated in-memory Supabase client.
      // persistSession: false + memory storage → zero impact on coordinator's cookies.
      const tempClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: {
            persistSession: false,
            storage: memoryStorage(),
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      )

      const { data, error: authErr } = await tempClient.auth.signInWithPassword({
        email: workerEmail,
        password,
      })

      if (authErr || !data.user) {
        setError('Contraseña incorrecta. Intenta de nuevo.')
        return
      }

      // Immediately sign out the temp session — it lives only in memory anyway
      await tempClient.auth.signOut().catch(() => {})

      onVerified(data.user.id, data.user.email ?? workerEmail)
    } catch {
      setError('Error al verificar. Intenta de nuevo.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-2xl space-y-5 p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              Verificación de identidad
            </h2>
            <p className="text-sm text-muted-foreground">
              Para firmar, <span className="font-medium text-foreground">{workerName}</span> debe
              ingresar su contraseña.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted/50 transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Legal notice */}
        <p className="text-xs text-muted-foreground border border-border/60 rounded-md px-3 py-2 bg-muted/20 leading-relaxed">
          Al verificar, <span className="font-medium text-foreground">{workerName}</span> confirma
          su identidad y acepta que la firma electrónica tiene plena validez jurídica, de
          conformidad con la Ley 527 de 1999 y el Decreto 2364 de 2012.
        </p>

        {/* Email (readonly) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Correo
          </label>
          <input
            type="email"
            value={workerEmail}
            readOnly
            className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
            autoFocus
            placeholder="Ingresa tu contraseña"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleVerify}
            disabled={!password || verifying}
            className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? 'Verificando…' : 'Verificar y continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
