import type { AuthUser, Permission, User } from '@/types'

type PermissibleUser =
  | Pick<User, 'permissions' | 'isMaster' | 'isTechnicalAdmin'>
  | Pick<AuthUser, 'permissions' | 'isMaster' | 'isTechnicalAdmin'>
  | null

type TechnicalUser =
  | Pick<User, 'isMaster' | 'isTechnicalAdmin'>
  | Pick<AuthUser, 'isMaster' | 'isTechnicalAdmin'>
  | null

export function hasPermission(user: PermissibleUser, permissionCode: string): boolean {
  if (!user) return false
  if (user.isMaster) return true
  return user.permissions.includes(permissionCode)
}

/** Acesso real às áreas técnicas (rotas/API): Master ou Administrador Técnico. */
export function canAccessTechnicalAdministration(user: TechnicalUser): boolean {
  if (!user) return false
  return user.isMaster === true || user.isTechnicalAdmin === true
}

/**
 * Visibilidade do menu ADMINISTRAÇÃO TÉCNICA.
 * Somente quando o checkbox "Administrador técnico" estiver marcado.
 * Master sem o flag não vê o menu (ainda pode acessar por URL se for Master).
 */
export function canSeeTechnicalAdministrationMenu(user: TechnicalUser): boolean {
  if (!user) return false
  return user.isTechnicalAdmin === true
}

export function getPermissionNameByCode(code: string, permissions: Permission[]): string {
  return permissions.find((p) => p.code === code)?.name ?? code
}

/** Badge de perfil para listagens — Master e Administrador Técnico são distintos. */
export function getUserRoleBadge(
  user: Pick<User, 'isMaster' | 'isTechnicalAdmin' | 'permissions'>
): { label: string; variant: 'info' | 'warning' | 'default' | 'success' } {
  if (user.isMaster) return { label: 'Master', variant: 'info' }
  if (user.isTechnicalAdmin) return { label: 'Administrador técnico', variant: 'warning' }
  const adminCodes = new Set([
    'gerenciar_usuarios',
    'gerenciar_setores',
    'gerenciar_categorias',
    'editar_configuracoes',
    'visualizar_auditoria',
  ])
  if (user.permissions.some((p) => adminCodes.has(p))) {
    return { label: 'Administrador', variant: 'success' }
  }
  return { label: 'Operacional', variant: 'default' }
}
