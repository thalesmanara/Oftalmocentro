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
  currentVersionId?: string | null
  currentVersionNumber?: number | null
  originalFileName?: string | null
  storedFileName?: string | null
  fileExtension?: string | null
  browserMimeType?: string | null
  detectedMimeType?: string | null
  checksum?: string | null
  checksumAlgorithm?: string | null
  validationStatus?: string | null
  validationErrorCode?: string | null
  validatedAt?: string | null
  pageCount?: number | null
  ocrStatus?: string | null
  ocrEngine?: string | null
  ocrLanguages?: string | null
  ocrAttempts?: number | null
  ocrErrorCode?: string | null
  ocrStartedAt?: string | null
  ocrFinishedAt?: string | null
  ocrDurationMs?: number | null
  extractionMethod?: string | null
  ocrDerivedFileName?: string | null
  ocrPageCount?: number | null
  hasOcrDerivedFile?: boolean | null
  ocrQualityScore?: number | null
  ocrQualityGrade?: string | null
  ocrWordCount?: number | null
  ocrUniqueWordCount?: number | null
  ocrCharacterCount?: number | null
  ocrCharactersPerPage?: number | null
  ocrQualityReason?: string | null
  ocrReviewReason?: string | null
  ocrMode?: string | null
  sheetCount?: number | null
  tableRowCount?: number | null
  tableColumnCount?: number | null
  tableSummary?: TableSummary | null
  hasTablePreview?: boolean | null
}

export interface TableSheetSummary {
  name?: string
  rows?: number
  columns?: number
  headers?: string[]
  hasMergedCells?: boolean
}

export interface TableSummary {
  sheetCount?: number
  rowCount?: number
  columnCount?: number
  sheets?: TableSheetSummary[]
  warnings?: string[]
  engine?: string
}

export interface TablePreviewRow {
  rowNumber: number
  values: string[]
}

export interface TablePreviewSheet {
  headers: string[]
  rows: TablePreviewRow[]
}

export interface TablePreviewResponse {
  documentId: string
  versionId?: string | null
  sheetCount?: number | null
  tableRowCount?: number | null
  tableColumnCount?: number | null
  tableSummary?: TableSummary | null
  preview?: Record<string, TablePreviewSheet> | null
  sheets?: Array<{
    sheetName: string
    sheetIndex?: number
    rowCount?: number
    columnCount?: number
    headers?: string[]
  }>
}

export type DocumentVersionStatus = 'PROCESSING' | 'READY' | 'FAILED' | 'ARCHIVED' | 'CURRENT'

export interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  isCurrent: boolean
  status: DocumentVersionStatus | string
  fileName?: string | null
  fileSize?: number | null
  mimeType?: string | null
  titleSnapshot?: string | null
  descriptionSnapshot?: string | null
  expirationDate?: string | null
  processingStatus?: string | null
  createdBy?: string | null
  createdByName?: string | null
  createdAt: string
  checksum?: string | null
  originalFileName?: string | null
  storedFileName?: string | null
  fileExtension?: string | null
  browserMimeType?: string | null
  detectedMimeType?: string | null
  checksumAlgorithm?: string | null
  validationStatus?: string | null
  validationErrorCode?: string | null
  validatedAt?: string | null
  pageCount?: number | null
  ocrStatus?: string | null
  ocrEngine?: string | null
  ocrLanguages?: string | null
  ocrAttempts?: number | null
  ocrErrorCode?: string | null
  ocrStartedAt?: string | null
  ocrFinishedAt?: string | null
  ocrDurationMs?: number | null
  extractionMethod?: string | null
  ocrDerivedFileName?: string | null
  ocrPageCount?: number | null
  hasOcrDerivedFile?: boolean | null
  ocrQualityScore?: number | null
  ocrQualityGrade?: string | null
  ocrWordCount?: number | null
  ocrUniqueWordCount?: number | null
  ocrCharacterCount?: number | null
  ocrCharactersPerPage?: number | null
  ocrQualityReason?: string | null
  ocrReviewReason?: string | null
  ocrMode?: string | null
  sheetCount?: number | null
  tableRowCount?: number | null
  tableColumnCount?: number | null
  tableSummary?: TableSummary | null
  hasTablePreview?: boolean | null
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

export type HealthStatus = 'ok' | 'degraded' | 'down'

export interface HealthComponent {
  status: HealthStatus | 'unknown'
  durationMs?: number
  storageAvailable?: boolean
  activeCount?: number
  openai?: string
  total?: number
  processing?: number
  errors?: number
  missingFiles?: number
  processedWithoutChunks?: number
  lastBackupAt?: string
  lastBackupStatus?: string
  lastBackupType?: string
  ageHours?: number
  available?: boolean
  version?: string
  languages?: string[] | string
  queue?: number
  failures?: number
  pending?: number
  avgDurationMs?: number
  stuck?: number
  avgQualityScore?: number
  excellentCount?: number
  goodCount?: number
  acceptableCount?: number
  poorCount?: number
  manualReviewCount?: number
  avgAttempts?: number
  lastRunAt?: string
  lastScore?: number
  casesCount?: number
}

export interface SystemHealth {
  status: HealthStatus
  checkedAt: string
  components: {
    n8n?: HealthComponent
    database?: HealthComponent
    storage?: HealthComponent
    tika?: HealthComponent
    ocr?: HealthComponent
    tabular?: HealthComponent
    configuration?: HealthComponent
    sessions?: HealthComponent
    audit?: HealthComponent
    documents?: HealthComponent
    backup?: HealthComponent
    aiEval?: HealthComponent
  }
}

export type BackupRunType =
  | 'DATABASE'
  | 'DOCUMENT_FILES'
  | 'N8N_WORKFLOWS'
  | 'FULL'
  | 'RESTORE_TEST'

export type BackupRunStatus = 'STARTED' | 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'VERIFIED'

export interface BackupRun {
  id: string
  backupType: BackupRunType | string
  status: BackupRunStatus | string
  startedAt: string
  finishedAt?: string | null
  durationMs?: number | null
  fileName?: string | null
  storageLocation?: string | null
  fileSize?: number | null
  checksum?: string | null
  recordsCount?: number | null
  errorCode?: string | null
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
}

export interface BackupLimitations {
  level?: string
  pgDump?: boolean
  externalStorage?: boolean
  restoreTestIsolated?: boolean
  documentPacking?: string
  disasterRecovery?: boolean
  [key: string]: unknown
}

export interface BackupDashboard {
  items: BackupRun[]
  lastByType?: Partial<Record<string, BackupRun | null>>
  limitations: BackupLimitations
  lastRestoreTest?: BackupRun | null
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
