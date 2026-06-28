'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/client'

export default function InvitePage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const searchParams = new URLSearchParams(window.location.search)

    // Newer Supabase format: token_hash + type arrive as query params.
    // Use verifyOtp — works without a PKCE code verifier (server-initiated invite).
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    if (tokenHash && type) {
      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: type as 'invite' | 'signup' | 'recovery' | 'email' })
        .then(({ error }) => {
          if (error) {
            router.replace('/auth/login?error=invalid_invite')
          } else {
            router.replace('/auth/set-password')
          }
        })
      return
    }

    // Implicit flow: tokens arrive in the URL hash (#access_token=...&refresh_token=...)
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            router.replace('/auth/login?error=invalid_invite')
          } else {
            router.replace('/auth/set-password')
          }
        })
      return
    }

    // PKCE flow: code arrives as a query param (client-initiated flows only)
    const code = searchParams.get('code')
    if (code) {
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) {
            router.replace('/auth/login?error=invalid_invite')
          } else {
            router.replace('/auth/set-password')
          }
        })
      return
    }

    router.replace('/auth/login?error=invalid_invite')
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Verificando invitación…</p>
    </main>
  )
}
