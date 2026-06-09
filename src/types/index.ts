/** Códigos de permissão utilizados no controle de acesso */
export type PermissionCode =
  | 'visualizar_documentos'
  | 'cadastrar_documentos'
  | 'editar_documentos'
  | 'excluir_documentos'
  | 'gerenciar_usuarios'
  | 'gerenciar_setores'
  | 'gerenciar_categorias'
  | 'gerenciar_tags'
  | 'visualizar_auditoria'
  | 'editar_configuracoes'
  | 'usar_consulta_ia'

/** Entidade de permissão (PostgreSQL / n8n) */
export interface Permission {
  id: string
  code: string
  name: string
}

/** Usuário autenticado na sessão (AuthContext / authService) */
export interface AuthUser {
  id: string
  name: string
  email: string
  sectorName: string
  isMaster: boolean
  permissions: string[]
}

export interface Sector {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  color: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  name: string
  email: string
  sectorId: string | null
  sectorName?: string | null
  active: boolean
  isMaster: boolean
  permissions: string[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  title: string
  sectorId: string
  sectorName?: string
  categoryId: string
  categoryName?: string
  semanticDescription: string
  tagIds: string[]
  tags?: Tag[]
  expirationDate: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  filePath?: string | null
  extractedText?: string | null
  responsibleUserId?: string | null
  responsibleUserName?: string | null
  createdBy?: string | null
  createdByName?: string | null
  updatedBy?: string | null
  updatedByName?: string | null
  createdAt: string
  updatedAt: string
}

export interface SystemSettings {
  id: string
  systemName: string
  clinicName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string | null
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  userId?: string
  userName?: string
  action: string
  entity: string
  entityId?: string
  details?: string
  ipAddress?: string
  createdAt: string
}

export interface DocumentFormData {
  title: string
  sectorId: string
  categoryId: string
  semanticDescription: string
  tagIds: string[]
  expirationDate: string | null
  file?: File | null
}

export interface UserFormData {
  name: string
  email: string
  password: string
  sectorId: string | null
  active: boolean
  isMaster: boolean
  permissions: string[]
}
