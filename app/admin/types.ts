export type AppUserRole = 'admin' | 'supervisor' | 'coordinator' | 'viewer'

export interface AppUser {
  id: string
  name: string
  email: string | null
  role: AppUserRole
  deactivated_at: string | null
}

export const ROLE_LABELS: Record<AppUserRole, string> = {
  admin:       'Administrador',
  supervisor:  'Supervisora',
  coordinator: 'Coordinador',
  viewer:      'Consultor',
}

export const ROLE_COLORS: Record<AppUserRole, string> = {
  admin:       'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
  supervisor:  'text-violet-400 bg-violet-400/10 border-violet-400/20',
  coordinator: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  viewer:      'text-slate-400 bg-slate-400/10 border-slate-400/20',
}
