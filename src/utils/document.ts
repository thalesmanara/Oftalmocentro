import type { Document } from '@/types'

export const MAX_UPLOAD_SIZE_BYTES = 26214400

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'tsv',
  'txt',
] as const

export const SPREADSHEET_EXTENSIONS = new Set(['xls', 'xlsx', 'csv', 'tsv'])

export function isSpreadsheetExtension(ext?: string | null): boolean {
  return SPREADSHEET_EXTENSIONS.has(String(ext || '').toLowerCase().replace(/^\./, ''))
}

export const ACCEPTED_FILE_TYPES = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')

const ALLOWED_EXTENSION_SET = new Set<string>(ALLOWED_EXTENSIONS)

export type FileClientValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

const VALIDATION_MESSAGES: Record<string, string> = {
  FILE_REQUIRED: 'Arquivo é obrigatório.',
  FILE_EMPTY: 'O arquivo está vazio.',
  FILE_TOO_LARGE: 'O arquivo excede o tamanho máximo permitido (25 MB).',
  FILE_EXTENSION_NOT_ALLOWED: 'Extensão de arquivo não permitida.',
  FILE_EXTENSION_MISMATCH: 'Nome do arquivo contém extensão inválida ou ambígua.',
  INVALID_FILE_NAME: 'Nome do arquivo contém caracteres inválidos.',
}

function validationFailure(code: string): FileClientValidationResult {
  return {
    ok: false,
    code,
    message: VALIDATION_MESSAGES[code] ?? 'Arquivo inválido.',
  }
}

function getFileExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const lastDot = base.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === base.length - 1) return ''
  return base.slice(lastDot + 1).toLowerCase()
}

/** Detecta extensão dupla ambígua (ex.: documento.pdf.exe). */
function hasExtensionMismatch(fileName: string): boolean {
  const base = fileName.split(/[/\\]/).pop() ?? fileName
  const parts = base.split('.').filter(Boolean)
  if (parts.length < 3) return false

  const finalExt = parts[parts.length - 1]?.toLowerCase() ?? ''
  const previousExt = parts[parts.length - 2]?.toLowerCase() ?? ''

  return ALLOWED_EXTENSION_SET.has(previousExt) && previousExt !== finalExt
}

export function validateFileClientSide(file: File | null | undefined): FileClientValidationResult {
  if (!file || !file.name?.trim()) {
    return validationFailure('FILE_REQUIRED')
  }

  const name = file.name.trim()

  if (/[/\\]/.test(name) || name.includes('\0') || name.includes('..')) {
    return validationFailure('INVALID_FILE_NAME')
  }

  if (file.size === 0) {
    return validationFailure('FILE_EMPTY')
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return validationFailure('FILE_TOO_LARGE')
  }

  if (hasExtensionMismatch(name)) {
    return validationFailure('FILE_EXTENSION_MISMATCH')
  }

  const extension = getFileExtension(name)
  if (!extension || !ALLOWED_EXTENSION_SET.has(extension)) {
    return validationFailure('FILE_EXTENSION_NOT_ALLOWED')
  }

  return { ok: true }
}

export function formatChecksumShort(checksum?: string | null): string {
  if (!checksum) return '—'
  const value = checksum.trim()
  if (!value) return '—'
  if (value.length <= 12) return value
  return `${value.slice(0, 12)}…`
}

const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  VALIDATING: 'Validando',
  VALID: 'Válido',
  INVALID: 'Inválido',
  FAILED: 'Falhou',
}

export function validationStatusLabel(status?: string | null): string {
  if (!status) return '—'
  return VALIDATION_STATUS_LABELS[status.toUpperCase()] ?? status
}

const OCR_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Não necessário',
  NOT_APPLICABLE: 'Não aplicável',
  REQUIRED: 'OCR necessário',
  OCR_REQUIRED: 'OCR necessário',
  PROCESSING: 'OCR em andamento',
  SUCCESS: 'OCR concluído',
  FAILED: 'OCR falhou',
  MANUAL_REVIEW: 'Revisão manual',
  OCR_BUSY: 'Fila ocupada',
  SKIPPED: 'OCR desativado',
}

const EXTRACTION_METHOD_LABELS: Record<string, string> = {
  tika: 'Apache Tika',
  ocr: 'OCR (OCRmyPDF)',
  tika_ocr: 'Tika + OCR',
  tabular: 'Planilha estruturada',
  sheetjs: 'Planilha estruturada',
}

export function ocrStatusLabel(status?: string | null): string {
  if (!status) return '—'
  return OCR_STATUS_LABELS[status.toUpperCase()] ?? status
}

const OCR_QUALITY_GRADE_LABELS: Record<string, string> = {
  EXCELLENT: 'Excelente',
  GOOD: 'Boa',
  ACCEPTABLE: 'Aceitável',
  POOR: 'Ruim',
  FAILED: 'Insuficiente',
  MANUAL_REVIEW: 'Revisão manual',
}

export function ocrQualityGradeLabel(grade?: string | null): string {
  if (!grade) return '—'
  return OCR_QUALITY_GRADE_LABELS[grade.toUpperCase()] ?? grade
}

export function ocrQualityGradeVariant(
  grade?: string | null
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch ((grade ?? '').toUpperCase()) {
    case 'EXCELLENT':
    case 'GOOD':
      return 'success'
    case 'ACCEPTABLE':
      return 'info'
    case 'POOR':
      return 'warning'
    case 'FAILED':
    case 'MANUAL_REVIEW':
      return 'danger'
    default:
      return 'default'
  }
}

export function ocrModeLabel(mode?: string | null): string {
  if (!mode) return '—'
  const value = mode.toUpperCase()
  if (value === 'HIGH_QUALITY') return 'Alta qualidade'
  if (value === 'STANDARD') return 'Padrão'
  return mode
}

export function formatOcrQualityScore(score?: number | null): string {
  if (score == null || !Number.isFinite(score)) return '—'
  return `${Math.round(score)}/100`
}

export function ocrStatusVariant(
  status?: string | null
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch ((status ?? '').toUpperCase()) {
    case 'SUCCESS':
    case 'NOT_REQUIRED':
    case 'NOT_APPLICABLE':
      return 'success'
    case 'PROCESSING':
    case 'REQUIRED':
    case 'OCR_REQUIRED':
    case 'OCR_BUSY':
      return 'warning'
    case 'FAILED':
    case 'MANUAL_REVIEW':
      return 'danger'
    case 'SKIPPED':
      return 'info'
    default:
      return 'default'
  }
}

const EMBEDDING_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  VALID: 'Válido',
  INVALID: 'Inválido',
  FAILED: 'Falhou',
  SKIPPED: 'Ignorado',
}

export function embeddingStatusLabel(status?: string | null): string {
  if (!status) return '—'
  return EMBEDDING_STATUS_LABELS[status.toUpperCase()] ?? status
}

export function embeddingStatusVariant(
  status?: string | null
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch ((status ?? '').toUpperCase()) {
    case 'VALID':
      return 'success'
    case 'PENDING':
    case 'PROCESSING':
      return 'warning'
    case 'INVALID':
    case 'FAILED':
      return 'danger'
    case 'SKIPPED':
      return 'info'
    default:
      return 'default'
  }
}

export function extractionMethodLabel(method?: string | null): string {
  if (!method) return '—'
  return EXTRACTION_METHOD_LABELS[method.toLowerCase()] ?? method
}

export function formatDurationMs(ms?: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

export function validationStatusVariant(
  status?: string | null
): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch ((status ?? '').toUpperCase()) {
    case 'VALID':
      return 'success'
    case 'INVALID':
    case 'FAILED':
      return 'danger'
    case 'VALIDATING':
      return 'warning'
    case 'PENDING':
      return 'info'
    default:
      return 'default'
  }
}

export function isDocumentExpired(doc: Document): boolean {
  if (!doc.expirationDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const vigencia = new Date(doc.expirationDate + 'T00:00:00')
  return vigencia < today
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Sem vigência'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR')
}
