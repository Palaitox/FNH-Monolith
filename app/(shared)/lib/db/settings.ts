import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppSettings } from '@/app/contracts/types'

// ── Settings / Config ──────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: AppSettings = {
  lugarTrabajo: 'CENTRO VIDA/DIA MUNICIPAL',
  formaPago: 'MENSUAL ENTRE EL DÍA QUINCE (15) Y EL DÍA VEINTE (20) DE CADA MES',
  empleadorNombre: 'FUNDACION NUEVO HORIZONTE',
  empleadorNit: '821.003.251-4',
  empleadorRepresentante: 'REPRESENTANTE LEGAL',
}

/**
 * Returns app settings merged with defaults. Falls back to defaults when
 * no config row exists yet (PGRST116) — this is expected on a fresh deployment.
 * Other DB errors are thrown.
 */
export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('config')
    .select('*')
    .eq('key', 'app_settings')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return { ...SETTINGS_DEFAULTS, ...(data?.value ?? {}) }
}

export async function saveSettings(
  supabase: SupabaseClient,
  settings: AppSettings,
): Promise<void> {
  const { error } = await supabase
    .from('config')
    .upsert({ key: 'app_settings', value: settings })
  if (error) throw error
}
