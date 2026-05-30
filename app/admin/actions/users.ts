'use server'

import { createClient } from '@/lib/server'
import { createSupabaseServiceClient } from '@/app/(shared)/lib/auth'
import { requireRole, getUserClaims } from '@/app/(shared)/lib/auth'
import { revalidatePath } from 'next/cache'
import type { AppUser, AppUserRole } from '@/app/admin/types'
import type { Employee } from '@/app/(shared)/lib/employee-types'

// ── Read ───────────────────────────────────────────────────────────────────

export async function listUsersAction(): Promise<AppUser[]> {
  await requireRole('admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, deactivated_at')
    .order('name', { ascending: true })

  if (error) throw error
  const users = (data ?? []) as AppUser[]

  // For workers, determine whether they've accepted their invitation by checking
  // email_confirmed_at in auth.users (null = invitation sent but not yet accepted).
  const workerIds = users.filter((u) => u.role === 'worker').map((u) => u.id)
  if (workerIds.length > 0) {
    const service = await createSupabaseServiceClient()
    const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 })
    const confirmedMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, !!u.email_confirmed_at]),
    )
    return users.map((u) =>
      u.role === 'worker'
        ? { ...u, invite_confirmed: confirmedMap.get(u.id) ?? false }
        : u,
    )
  }

  return users
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
    redirectTo: `${appUrl}/auth/invite`,
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

  const supabase = await createSupabaseServiceClient()
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

// ── Hard delete ────────────────────────────────────────────────────────────

export async function deleteUserAction(id: string): Promise<void> {
  await requireRole('admin')

  // Guard: admin cannot delete themselves
  const claims = await getUserClaims()
  if (claims?.sub === id) throw new Error('No puedes eliminar tu propia cuenta.')

  const supabase = await createSupabaseServiceClient()

  // Delete public.users row first (FK references auth.users)
  const { error: dbError } = await supabase.from('users').delete().eq('id', id)
  if (dbError) throw new Error(`Error al eliminar el usuario: ${dbError.message}`)

  // Delete the auth user (invalidates all sessions and removes auth record)
  const { error: authError } = await supabase.auth.admin.deleteUser(id)
  if (authError) throw new Error(`Error al eliminar la cuenta: ${authError.message}`)

  revalidatePath('/admin')
}

// ── Worker account management ──────────────────────────────────────────────
// Coordinators and admins can invite employees to create a worker account,
// which enables identity verification before digital signing.

export async function inviteWorkerAction(
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const service = await createSupabaseServiceClient()

  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle()

  if (empErr || !emp) return { error: 'Empleado no encontrado.' }

  const employee = emp as unknown as Employee

  if (employee.user_id) return { error: 'Este empleado ya tiene una cuenta de firma.' }
  if (!employee.correo) return { error: 'El empleado no tiene correo registrado. Agrégalo primero en el perfil.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://fnh-monolith.vercel.app'
  const { data, error: authError } = await service.auth.admin.inviteUserByEmail(employee.correo, {
    redirectTo: `${appUrl}/auth/invite`,
  })

  if (authError) {
    if (authError.message.includes('already been registered')) {
      return { error: 'Ya existe una cuenta con ese correo. Contacta al administrador.' }
    }
    return { error: `Error al enviar la invitación: ${authError.message}` }
  }

  const { error: userErr } = await service.from('users').insert({
    id: data.user.id,
    name: employee.full_name.toUpperCase(),
    email: employee.correo,
    role: 'worker',
  })

  if (userErr) {
    await service.auth.admin.deleteUser(data.user.id).catch(() => {})
    return { error: `Error al registrar la cuenta: ${userErr.message}` }
  }

  const { error: linkErr } = await service
    .from('employees')
    .update({ user_id: data.user.id })
    .eq('id', employeeId)

  if (linkErr) {
    try { await service.from('users').delete().eq('id', data.user.id) } catch { /* rollback best-effort */ }
    await service.auth.admin.deleteUser(data.user.id).catch(() => {})
    return { error: `Error al vincular la cuenta: ${linkErr.message}` }
  }

  revalidatePath(`/employees/${employeeId}`)
  return { success: true }
}

export async function revokeWorkerAccountAction(
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  await requireRole('coordinator')
  const supabase = await createClient()
  const service = await createSupabaseServiceClient()

  const { data: emp } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .maybeSingle()

  const userId = (emp as { user_id: string | null } | null)?.user_id
  if (!userId) return { error: 'Este empleado no tiene cuenta de firma.' }

  // Delete public.users row first (FK order — ND-42 pattern)
  const { error: dbErr } = await service.from('users').delete().eq('id', userId)
  if (dbErr) return { error: `Error al eliminar la cuenta: ${dbErr.message}` }

  // Delete auth user — ON DELETE SET NULL clears employees.user_id automatically
  await service.auth.admin.deleteUser(userId).catch(() => {})

  revalidatePath(`/employees/${employeeId}`)
  return { success: true }
}
