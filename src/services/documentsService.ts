import {
  ApiError,
  apiDelete,
  apiDownload,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
} from './api'
import type { Document, DocumentFormData } from '@/types'

export interface DocumentFileUploadResult {
  id: string
  title: string
  fileName: string
  fileType: string
  fileSize: number
  filePath: string
  updatedAt: string
}

export interface DocumentProcessResult {
  success: boolean
  message: string
  documentId: string
  chunks?: number
}

function normalizeExpirationDate(value: string | null | undefined): string | null {
  if (!value) return null
  return value.split('T')[0]
}

function normalizeDocument(doc: Document): Document {
  return {
    ...doc,
    subcategoryId: doc.subcategoryId ?? null,
    subcategoryName: doc.subcategoryName ?? null,
    subcategoryDescription: doc.subcategoryDescription ?? null,
    expirationDate: normalizeExpirationDate(doc.expirationDate),
  }
}

async function buildUpdatePayload(
  existing: Document,
  data: DocumentFormData,
  userId: string
) {
  return {
    id: existing.id,
    title: data.title.trim(),
    sectorId: data.sectorId,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId ?? null,
    semanticDescription: data.semanticDescription.trim(),
    expirationDate: data.expirationDate || null,
    fileName: existing.fileName ?? null,
    fileType: existing.fileType ?? null,
    fileSize: existing.fileSize ?? null,
    filePath: existing.filePath ?? null,
    extractedText: existing.extractedText ?? null,
    responsibleUserId: existing.responsibleUserId ?? userId,
    updatedBy: userId,
  }
}

function parseDocument(data: unknown): Document | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseDocument(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id) {
    const doc = record as unknown as Document
    return normalizeDocument({
      ...doc,
      title: doc.title ?? '',
      sectorId: doc.sectorId ?? '',
      categoryId: doc.categoryId ?? '',
      subcategoryId: doc.subcategoryId ?? null,
      subcategoryName: doc.subcategoryName ?? null,
      subcategoryDescription: doc.subcategoryDescription ?? null,
      semanticDescription: doc.semanticDescription ?? '',
      expirationDate: doc.expirationDate ?? null,
      createdAt: doc.createdAt ?? new Date().toISOString(),
      updatedAt: doc.updatedAt ?? new Date().toISOString(),
    })
  }

  if (record.document) {
    return parseDocument(record.document)
  }

  if (record.data) {
    return parseDocument(record.data)
  }

  return null
}

function extractDocumentIdFromResponse(data: unknown): string | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return extractDocumentIdFromResponse(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (typeof record.id === 'string' && record.id) {
    return record.id
  }

  if (typeof record.documentId === 'string' && record.documentId) {
    return record.documentId
  }

  if (record.document) {
    return extractDocumentIdFromResponse(record.document)
  }

  if (record.data) {
    return extractDocumentIdFromResponse(record.data)
  }

  return null
}

function buildMinimalCreatedDocument(id: string, match: {
  title: string
  sectorId: string
  categoryId: string
}): Document {
  const now = new Date().toISOString()

  return normalizeDocument({
    id,
    title: match.title,
    sectorId: match.sectorId,
    categoryId: match.categoryId,
    subcategoryId: null,
    semanticDescription: '',
    expirationDate: null,
    createdAt: now,
    updatedAt: now,
  })
}

async function resolveDocumentAfterCreate(
  result: unknown,
  match: { title: string; sectorId: string; categoryId: string }
): Promise<Document> {
  const parsed = parseDocument(result)
  if (parsed?.id) return parsed

  const extractedId = extractDocumentIdFromResponse(result)
  if (extractedId) {
    const foundById = await getDocumentById(extractedId)
    if (foundById) return foundById

    return buildMinimalCreatedDocument(extractedId, match)
  }

  throw new ApiError({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Documento criado não encontrado',
  })
}

async function resolveDocumentAfterUpdate(_result: unknown, id: string): Promise<Document> {
  const refreshed = await getDocumentById(id)
  if (refreshed) return refreshed

  throw new ApiError({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Resposta inválida ao atualizar documento',
  })
}

export async function getDocuments(): Promise<Document[]> {
  const data = await apiGet<unknown>('/webhook/documents')
  if (!Array.isArray(data)) return []
  return data.map((doc) => normalizeDocument(doc as Document))
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const documents = await getDocuments()
  return documents.find((d) => d.id === id) ?? null
}

export async function createDocument(
  data: DocumentFormData,
  userId: string,
  _userName: string
): Promise<Document> {
  const result = await apiPost<unknown>('/webhook/documents/create', {
    title: data.title.trim(),
    sectorId: data.sectorId,
    categoryId: data.categoryId,
    subcategoryId: data.subcategoryId ?? null,
    semanticDescription: data.semanticDescription.trim(),
    expirationDate: data.expirationDate || null,
    fileName: null,
    fileType: null,
    fileSize: null,
    filePath: null,
    extractedText: null,
    responsibleUserId: userId,
    createdBy: userId,
    updatedBy: userId,
  })

  return resolveDocumentAfterCreate(result, {
    title: data.title.trim(),
    sectorId: data.sectorId,
    categoryId: data.categoryId,
  })
}

export async function updateDocument(
  id: string,
  data: DocumentFormData,
  userId: string,
  _userName: string,
  currentDocument?: Document
): Promise<Document> {
  const existing = currentDocument ?? (await getDocumentById(id))
  if (!existing) {
    throw new ApiError({
      status: 404,
      code: 'DOCUMENT_NOT_FOUND',
      message: 'Documento não encontrado',
    })
  }

  const payload = await buildUpdatePayload(existing, data, userId)

  const result = await apiPut<unknown>('/webhook/documents/update', payload)

  return resolveDocumentAfterUpdate(result, id)
}

function parseUploadResult(data: unknown): DocumentFileUploadResult | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseUploadResult(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id && record.fileName) {
    return record as unknown as DocumentFileUploadResult
  }

  if (record.data) {
    return parseUploadResult(record.data)
  }

  return null
}

export async function uploadDocumentFile(
  documentId: string,
  file: File
): Promise<DocumentFileUploadResult> {
  const formData = new FormData()
  formData.append('documentId', documentId)
  formData.append('file', file)

  const result = await apiUpload<unknown>('/webhook/documents/upload', formData)

  const parsed = parseUploadResult(result)
  if (parsed) return parsed

  const refreshed = await getDocumentById(documentId)
  if (refreshed?.fileName) {
    return {
      id: refreshed.id,
      title: refreshed.title,
      fileName: refreshed.fileName,
      fileType: refreshed.fileType ?? '',
      fileSize: refreshed.fileSize ?? 0,
      filePath: refreshed.filePath ?? '',
      updatedAt: refreshed.updatedAt,
    }
  }

  throw new ApiError({
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Resposta inválida ao enviar arquivo do documento',
  })
}

export async function processDocument(documentId: string): Promise<DocumentProcessResult> {
  const result = await apiPost<unknown>('/webhook/documents/process', { documentId })

  if (Array.isArray(result)) {
    return {
      success: true,
      message: 'Documento processado com sucesso',
      documentId,
      chunks: result.length,
    }
  }

  if (result && typeof result === 'object') {
    const record = result as Record<string, unknown>

    return {
      success: true,
      message: String(record.message ?? 'Documento processado com sucesso'),
      documentId: String(record.documentId ?? record.id ?? documentId),
      chunks: typeof record.chunks === 'number' ? record.chunks : undefined,
    }
  }

  return {
    success: true,
    message: 'Documento processado com sucesso',
    documentId,
  }
}

export async function deleteDocument(id: string): Promise<void> {
  await apiDelete('/webhook/documents/delete', { id })
}

export async function downloadDocumentFile(
  documentId: string,
  fallbackFileName?: string | null
): Promise<void> {
  const { blob, fileName } = await apiDownload(
    `/webhook/documents/download?documentId=${encodeURIComponent(documentId)}`
  )

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName ?? fallbackFileName ?? 'documento'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
