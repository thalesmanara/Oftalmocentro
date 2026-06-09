import type { Document } from '@/types'

export function isDocumentExpired(doc: Document): boolean {
  if (!doc.expirationDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const validade = new Date(doc.expirationDate + 'T00:00:00')
  return validade < today
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Sem validade'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR')
}

export const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt'
