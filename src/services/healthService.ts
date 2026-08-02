import { apiGet } from './api'
import type { HealthComponent, HealthStatus, SystemHealth } from '@/types'

export type { HealthComponent, HealthStatus, SystemHealth }

export interface PublicHealth {
  status: HealthStatus
  service: string
  timestamp: string
}

/** Health check público mínimo (sem autenticação). */
export async function getPublicHealth(): Promise<PublicHealth> {
  return apiGet<PublicHealth>('/webhook/health', { public: true })
}

/** Diagnóstico administrativo detalhado. Requer editar_configuracoes. */
export async function getSystemHealth(): Promise<SystemHealth> {
  return apiGet<SystemHealth>('/webhook/system/health')
}
