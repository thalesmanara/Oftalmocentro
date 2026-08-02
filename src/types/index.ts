/** Códigos de permissão utilizados no controle de acesso */
export type PermissionCode =
  | 'visualizar_documentos'
  | 'cadastrar_documentos'
  | 'editar_documentos'
  | 'excluir_documentos'
  | 'gerenciar_usuarios'
  | 'gerenciar_setores'
  | 'gerenciar_categorias'
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

export interface Subcategory {
  id: string
  categoryId: string
  categoryName?: string
  name: string
  description?: string | null
  active: boolean
  createdAt?: string
  updatedAt?: string
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
  subcategoryId?: string | null
  subcategoryName?: string | null
  subcategoryDescription?: string | null
  semanticDescription: string
  expirationDate: string | null
  fileName?: string | null
  fileType?: string | null
  fileSize?: number | null
  filePath?: string | null
  extractedText?: string | null
  processingStatus?: string | null
  processedAt?: string | null
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
  occurredAt: string
  userId?: string | null
  userName?: string | null
  action: string
  resourceType: string
  resourceId?: string | null
  success: boolean
  requestId: string
  method?: string | null
  path?: string | null
  statusCode?: number | null
  durationMs?: number | null
  ipAddress?: string | null
  userAgent?: string | null
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  errorCode?: string | null
}

export interface AuditPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface AuditListResult {
  items: AuditLog[]
  pagination: AuditPagination
}

export interface AuditFilters {
  page?: number
  pageSize?: number
  userId?: string
  action?: string
  resourceType?: string
  resourceId?: string
  success?: boolean | ''
  requestId?: string
  errorCode?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface DocumentFormData {
  title: string
  sectorId: string
  categoryId: string
  subcategoryId?: string | null
  semanticDescription: string
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
