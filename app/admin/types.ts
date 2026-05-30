// Roles that can be assigned via the admin invite form (excludes worker)
export type ManagementRole = 'admin' | 'supervisor' | 'coordinator' | 'viewer'

// All roles including worker — used in the admin user list display
export type AppUserRole = ManagementRole | 'worker'

export interface AppUser {
  id: string
  name: string
  email: string | null
  role: AppUserRole
  deactivated_at: string | null
  invite_confirmed?: boolean  // workers only: true once they've set their password
}

// Management roles only — used in the invite form role selector
export const MANAGEMENT_ROLES: ManagementRole[] = ['admin', 'supervisor', 'coordinator', 'viewer']

export const ROLE_LABELS: Record<ManagementRole, string> = {
  admin:       'Administrador',
  supervisor:  'Supervisora',
  coordinator: 'Coordinador',
  viewer:      'Consultor',
}

export const ROLE_COLORS: Record<ManagementRole, string> = {
  admin:       'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  supervisor:  'text-violet-400 bg-violet-400/10 border-violet-400/20',
  coordinator: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  viewer:      'text-slate-400 bg-slate-400/10 border-slate-400/20',
}
