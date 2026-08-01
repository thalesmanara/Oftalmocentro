import { apiGet } from './api'
import type { Permission } from '@/types'

function withoutLegacyTagPermission(permissions: Permission[]): Permission[] {
  return permissions.filter((permission) => permission.code !== 'gerenciar_tags')
}

export async function getPermissions(): Promise<Permission[]> {
  const data = await apiGet<unknown>('/webhook/permissions')
  if (!Array.isArray(data)) return []
  return withoutLegacyTagPermission(data as Permission[])
}
