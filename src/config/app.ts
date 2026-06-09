/**
 * Basename do React Router derivado do `base` do Vite.
 * Produção: https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/
 */
export function getRouterBasename(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, '') || '/'
}
