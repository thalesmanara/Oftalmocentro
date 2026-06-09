import type { AuthUser, Permission, User } from '@/types'

type PermissibleUser =
  | Pick<User, 'permissions' | 'isMaster'>
  | Pick<AuthUser, 'permissions' | 'isMaster'>
  | null

export function hasPermission(user: PermissibleUser, permissionCode: string): boolean {
  if (!user) return false
  if (user.isMaster) return true
  return user.permissions.includes(permissionCode)
}

export function getPermissionNameByCode(code: string, permissions: Permission[]): string {
  return permissions.find((p) => p.code === code)?.name ?? code
}
