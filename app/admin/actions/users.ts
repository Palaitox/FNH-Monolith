'use server'

import { createClient } from '@/lib/server'
import { createSupabaseServiceClient } from '@/app/(shared)/lib/auth'
import { requireRole, getUserClaims } from '@/app/(shared)/lib/auth'
import { revalidatePath } from 'next/cache'
import type { AppUser, AppUserRole } from '@/app/admin/types'

// ── Read ───────────────────────────────────────────────────────────────────

export async function listUsersAction(): Promise<AppUser[]> {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, deactivated_at')
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as AppUser[]
}

export async function getUserAction(id: string): Promise<AppUser | null> {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, deactivated_at')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as AppUser | null
}

// ── Create (invite) ────────────────────────────────────────────────────────
// Uses auth.admin.inviteUserByEmail — requires service client (ND-32).
// Supabase sends the user an account-setup email automatically.
// The public.users row is inserted immediately with the returned auth ID (ND-33).

export async function inviteUserAction(input: {
  name: string
  email: string
  role: AppUserRole
}): Promise<void> {
  await requireRole('admin')

  const name = input.name.trim().toUpperCase()
  const email = input.email.trim().toLowerCase()

  if (!name) throw new Error('El nombre es obligatorio.')
  if (!email || !email.includes('@')) throw new Error('El correo no es válido.')

  const supabase = await createSupabaseServiceClient()

  // Step 1: invite via Supabase Auth (sends setup email to the user)
  // redirectTo sends the user back to our app to set their password,
  // not to the Supabase hosted UI.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fnh-monolith.vercel.app'
  const { data, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/auth/set-password`,
  })
  if (authError) {
    if (authError.message.includes('already been registered')) {
      throw new Error('Ya existe una cuenta con ese correo.')
    }
    throw new Error(`Error al enviar la invitación: ${authError.message}`)
  }

  // Step 2: create the public.users row with the returned auth ID
  const { error: dbError } = await supabase.from('users').insert({
    id: data.user.id,
    name,
    email,
    role: input.role,
  })

  if (dbError) {
    // Rollback: delete the auth user so state stays consistent
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {})
    throw new Error(`Error al registrar el usuario: ${dbError.message}`)
  }

  revalidatePath('/admin')
}

// ── Update role ────────────────────────────────────────────────────────────

export async function updateRoleAction(id: string, role: AppUserRole): Promise<void> {
  await requireRole('admin')

  // Guard: admin cannot change their own role (ND-34)
  const claims = await getUserClaims()
  if (claims?.sub === id) throw new Error('No puedes cambiar tu propio rol.')

  const supabase = await createClient()
  const { error } = await supabase.from('users').update({ role }).eq('id', id)
  if (error) throw error

  revalidatePath('/admin')
  revalidatePath(`/admin/users/${id}`)
}

// ── Soft-delete (deactivate) ───────────────────────────────────────────────

export async function deactivateUserAction(id: string): Promise<void> {
  await requireRole('admin')

  // Guard: admin cannot deactivate themselves (ND-34)
  const claims = await getUserClaims()
  if (claims?.sub === id) throw new Error('No puedes desactivar tu propia cuenta.')

  const supabase = await createSupabaseServiceClient()

  // Mark as deactivated in public.users
  const { error } = await supabase
    .from('users')
    .update({ deactivated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error

  // Invalidate all active sessions for this user
  await supabase.auth.admin.signOut(id)

  revalidatePath('/admin')
  revalidatePath(`/admin/users/${id}`)
}

// ── Reactivate ─────────────────────────────────────────────────────────────

export async function reactivateUserAction(id: string): Promise<void> {
  await requireRole('admin')

  const supabase = await createClient()
  const { error } = await supabase
    .from('users')
    .update({ deactivated_at: null })
    .eq('id', id)

  if (error) throw error

  revalidatePath('/admin')
  revalidatePath(`/admin/users/${id}`)
}
