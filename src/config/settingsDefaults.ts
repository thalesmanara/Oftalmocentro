import type { SystemSettings } from '@/types'

/**
 * Defaults visuais seguros (login/CSS).
 * Não representam configuração corporativa carregada da API.
 */
export const VISUAL_SETTINGS_DEFAULTS: SystemSettings = {
  id: 'visual-defaults',
  systemName: 'Oftalmocentro Inteligente',
  clinicName: 'Oftalmocentro Uberaba',
  logoUrl: null,
  primaryColor: '#1e3a8a',
  secondaryColor: '#0f172a',
  createdAt: '',
  updatedAt: '',
}

export function isVisualSettingsDefault(settings: SystemSettings): boolean {
  return settings.id === VISUAL_SETTINGS_DEFAULTS.id
}
