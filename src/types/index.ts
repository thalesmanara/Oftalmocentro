export type Permission =
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

export const ALL_PERMISSIONS: Permission[] = [
  'visualizar_documentos',
  'cadastrar_documentos',
  'editar_documentos',
  'excluir_documentos',
  'gerenciar_usuarios',
  'gerenciar_setores',
  'gerenciar_categorias',
  'gerenciar_tags',
  'visualizar_auditoria',
  'editar_configuracoes',
  'usar_consulta_ia',
]

/** Usuário autenticado na sessão (AuthContext / authService) */
export interface AuthUser {
  id: string
  name: string
  email: string
  sectorName: string
  isMaster: boolean
  permissions: Permission[]
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  visualizar_documentos: 'Visualizar documentos',
  cadastrar_documentos: 'Cadastrar documentos',
  editar_documentos: 'Editar documentos',
  excluir_documentos: 'Excluir documentos',
  gerenciar_usuarios: 'Gerenciar usuários',
  gerenciar_setores: 'Gerenciar setores',
  gerenciar_categorias: 'Gerenciar categorias',
  gerenciar_tags: 'Gerenciar tags',
  visualizar_auditoria: 'Visualizar auditoria',
  editar_configuracoes: 'Editar configurações',
  usar_consulta_ia: 'Usar consulta IA',
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
  sectorName?: string
  active: boolean
  isMaster: boolean
  permissions: Permission[]
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
  fileName?: string
  fileType?: string
  fileSize?: number
  filePath?: string
  extractedText?: string
  responsibleUserId?: string
  responsibleUserName?: string
  createdBy?: string
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export interface SystemSettings {
  id: string
  systemName: string
  clinicName: string
  logoUrl?: string | null
  primaryColor: string
  secondaryColor?: string | null
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
  permissions: Permission[]
}
