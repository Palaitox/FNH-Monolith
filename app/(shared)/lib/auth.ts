import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Browser client — use in Client Components ('use client').
 * Prefer importing from @/lib/client for simple cases;
 * this export exists for consistency within (shared)/lib.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}

/**
 * Server client — use in Server Components, Server Actions, and Route Handlers.
 * Prefer importing from @/lib/server for simple cases.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component — session refresh will be
            // handled by middleware on the next request.
          }
        },
      },
    },
  )
}

/**
 * Service client — use only in trusted server contexts (cron, admin actions).
 * Uses SUPABASE_SECRET_KEY which bypasses RLS. NEVER expose to the client.
 */
export async function createSupabaseServiceClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component context — no-op.
          }
        },
      },
    },
  )
}

/**
 * Returns the authenticated user's JWT claims, or null.
 * Fast: reads from cookie without a server round-trip.
 * Use for UI-level checks. For data access, RLS is the real guard.
 */
export async function getUserClaims() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims ?? null
}

/**
 * Returns the user's role from public.users, or null.
 */
export async function getUserRole(): Promise<'admin' | 'coordinator' | 'viewer' | null> {
  const claims = await getUserClaims()
  if (!claims) return null

  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', claims.sub)
    .is('deactivated_at', null)
    .maybeSingle()

  return (data?.role as 'admin' | 'coordinator' | 'viewer') ?? null
}

const ROLE_HIERARCHY: Record<string, number> = { viewer: 0, coordinator: 1, admin: 2 }

/**
 * Throws if the authenticated user's role is below `minimum`.
 * Use at the top of Server Action mutations.
 *
 * @throws Error('Unauthorized') — caught by Next.js and surfaced as a server error.
 */
export async function requireRole(minimum: 'viewer' | 'coordinator' | 'admin'): Promise<void> {
  const role = await getUserRole()
  if (role === null || ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minimum]) {
    throw new Error(`Unauthorized: requires '${minimum}' role or higher`)
  }
}
