'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/client'

export default function InvitePage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

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

    // PKCE flow fallback: code arrives as a query param
    const code = new URLSearchParams(window.location.search).get('code')
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
