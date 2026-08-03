import {
  ApiError,
  apiDelete,
  apiDownload,
  apiGet,
  apiPost,
  apiPut,
  apiUpload,
} from './api'
import { expectArray } from '@/utils/expectArray'
import type { Document, DocumentFormData, DocumentVersion, TablePreviewResponse } from '@/types'

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

function pickRaw(
  record: Record<string, unknown>,
  ...keys: string[]
): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key]
    }
  }
  return null
}

function pickString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  const value = pickRaw(record, ...keys)
  if (value == null) return null
  return String(value)
}

function pickNumber(
  record: Record<string, unknown>,
  ...keys: string[]
): number | null {
  const value = pickRaw(record, ...keys)
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeFileValidationFields(record: Record<string, unknown>) {
  return {
    originalFileName: pickString(record, 'originalFileName', 'original_file_name'),
    storedFileName: pickString(record, 'storedFileName', 'stored_file_name'),
    fileExtension: pickString(record, 'fileExtension', 'file_extension'),
    browserMimeType: pickString(record, 'browserMimeType', 'browser_mime_type'),
    detectedMimeType: pickString(record, 'detectedMimeType', 'detected_mime_type'),
    checksum: pickString(record, 'checksum'),
    checksumAlgorithm: pickString(record, 'checksumAlgorithm', 'checksum_algorithm'),
    validationStatus: pickString(record, 'validationStatus', 'validation_status'),
    validationErrorCode: pickString(record, 'validationErrorCode', 'validation_error_code'),
    validatedAt: pickString(record, 'validatedAt', 'validated_at'),
    pageCount: pickNumber(record, 'pageCount', 'page_count'),
  }
}

function normalizeOcrFields(record: Record<string, unknown>) {
  const hasDerived =
    record.hasOcrDerivedFile === true ||
    record.has_ocr_derived_file === true ||
    Boolean(pickString(record, 'ocrDerivedFileName', 'ocr_derived_file_name'))

  return {
    ocrStatus: pickString(record, 'ocrStatus', 'ocr_status'),
    ocrEngine: pickString(record, 'ocrEngine', 'ocr_engine'),
    ocrLanguages: pickString(record, 'ocrLanguages', 'ocr_languages'),
    ocrAttempts: pickNumber(record, 'ocrAttempts', 'ocr_attempts'),
    ocrErrorCode: pickString(record, 'ocrErrorCode', 'ocr_error_code'),
    ocrStartedAt: pickString(record, 'ocrStartedAt', 'ocr_started_at'),
    ocrFinishedAt: pickString(record, 'ocrFinishedAt', 'ocr_finished_at'),
    ocrDurationMs: pickNumber(record, 'ocrDurationMs', 'ocr_duration_ms'),
    extractionMethod: pickString(record, 'extractionMethod', 'extraction_method'),
    ocrDerivedFileName: pickString(record, 'ocrDerivedFileName', 'ocr_derived_file_name'),
    ocrPageCount: pickNumber(record, 'ocrPageCount', 'ocr_page_count'),
    hasOcrDerivedFile: hasDerived || null,
    ocrQualityScore: pickNumber(record, 'ocrQualityScore', 'ocr_quality_score'),
    ocrQualityGrade: pickString(record, 'ocrQualityGrade', 'ocr_quality_grade'),
    ocrWordCount: pickNumber(record, 'ocrWordCount', 'ocr_word_count'),
    ocrUniqueWordCount: pickNumber(record, 'ocrUniqueWordCount', 'ocr_unique_word_count'),
    ocrCharacterCount: pickNumber(record, 'ocrCharacterCount', 'ocr_character_count'),
    ocrCharactersPerPage: pickNumber(record, 'ocrCharactersPerPage', 'ocr_characters_per_page'),
    ocrQualityReason: pickString(record, 'ocrQualityReason', 'ocr_quality_reason'),
    ocrReviewReason: pickString(record, 'ocrReviewReason', 'ocr_review_reason'),
    ocrMode: pickString(record, 'ocrMode', 'ocr_mode'),
    sheetCount: pickNumber(record, 'sheetCount', 'sheet_count'),
    tableRowCount: pickNumber(record, 'tableRowCount', 'table_row_count'),
    tableColumnCount: pickNumber(record, 'tableColumnCount', 'table_column_count'),
    tableSummary: (record.tableSummary ?? record.table_summary ?? null) as Document['tableSummary'],
    hasTablePreview:
      record.hasTablePreview === true ||
      record.has_table_preview === true ||
      Boolean(record.tableSummary ?? record.table_summary) ||
      null,
  }
}

function normalizeDocument(doc: Document | Record<string, unknown>): Document {
  const record = doc as Record<string, unknown>
  const base = doc as Document

  return {
    ...base,
    subcategoryId: (base.subcategoryId ?? pickString(record, 'subcategoryId', 'subcategory_id')) ?? null,
    subcategoryName:
      (base.subcategoryName ?? pickString(record, 'subcategoryName', 'subcategory_name')) ?? null,
    subcategoryDescription:
      (base.subcategoryDescription ??
        pickString(record, 'subcategoryDescription', 'subcategory_description')) ?? null,
    expirationDate: normalizeExpirationDate(
      base.expirationDate ?? pickString(record, 'expirationDate', 'expiration_date')
    ),
    fileName: base.fileName ?? pickString(record, 'fileName', 'file_name'),
    fileType: base.fileType ?? pickString(record, 'fileType', 'file_type'),
    fileSize: base.fileSize ?? pickNumber(record, 'fileSize', 'file_size'),
    filePath: base.filePath ?? pickString(record, 'filePath', 'file_path'),
    ...normalizeFileValidationFields(record),
    ...normalizeOcrFields(record),
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
  return expectArray(data, 'documentos').map((doc) => normalizeDocument(doc as Document))
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

function normalizeDocumentVersion(record: Record<string, unknown>): DocumentVersion {
  return {
    id: String(record.id ?? ''),
    documentId: String(record.documentId ?? record.document_id ?? ''),
    versionNumber: Number(record.versionNumber ?? record.version_number ?? 0),
    isCurrent: record.isCurrent === true || record.is_current === true,
    status: String(record.status ?? ''),
    fileName: pickString(record, 'fileName', 'file_name'),
    fileSize: pickNumber(record, 'fileSize', 'file_size'),
    mimeType: pickString(record, 'mimeType', 'mime_type'),
    titleSnapshot: pickString(record, 'titleSnapshot', 'title_snapshot'),
    descriptionSnapshot: pickString(record, 'descriptionSnapshot', 'description_snapshot'),
    expirationDate: normalizeExpirationDate(
      pickString(record, 'expirationDate', 'expiration_date')
    ),
    processingStatus: pickString(record, 'processingStatus', 'processing_status'),
    createdBy: pickString(record, 'createdBy', 'created_by'),
    createdByName: pickString(record, 'createdByName', 'created_by_name'),
    createdAt: String(record.createdAt ?? record.created_at ?? ''),
    ...normalizeFileValidationFields(record),
    ...normalizeOcrFields(record),
  }
}

function parseDocumentVersion(data: unknown): DocumentVersion | null {
  if (!data) return null

  if (Array.isArray(data) && data.length > 0) {
    return parseDocumentVersion(data[0])
  }

  if (typeof data !== 'object') return null

  const record = data as Record<string, unknown>

  if (record.id) {
    return normalizeDocumentVersion(record)
  }

  if (record.version) {
    return parseDocumentVersion(record.version)
  }

  if (record.data) {
    return parseDocumentVersion(record.data)
  }

  return null
}

export async function getTabularPreview(
  documentId: string,
  versionId?: string | null
): Promise<TablePreviewResponse> {
  const qs = new URLSearchParams({ documentId })
  if (versionId) qs.set('versionId', versionId)
  const data = await apiGet<unknown>(`/webhook/documents/tabular/preview?${qs.toString()}`)
  const record = (data && typeof data === 'object' && 'data' in (data as object)
    ? ((data as { data: unknown }).data as Record<string, unknown>)
    : (data as Record<string, unknown>)) || {}

  return {
    documentId: String(record.documentId ?? record.document_id ?? documentId),
    versionId: (record.versionId ?? record.version_id ?? versionId ?? null) as string | null,
    sheetCount: Number(record.sheetCount ?? record.sheet_count ?? 0) || null,
    tableRowCount: Number(record.tableRowCount ?? record.table_row_count ?? 0) || null,
    tableColumnCount: Number(record.tableColumnCount ?? record.table_column_count ?? 0) || null,
    tableSummary: (record.tableSummary ??
      record.table_summary ??
      record.summary ??
      null) as TablePreviewResponse['tableSummary'],
    preview: (record.preview ??
      record.tablePreview ??
      record.table_preview ??
      null) as TablePreviewResponse['preview'],
    sheets: (record.sheets as TablePreviewResponse['sheets']) ?? undefined,
  }
}

export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const data = await apiGet<unknown>(
    `/webhook/documents/versions?documentId=${encodeURIComponent(documentId)}`
  )
  return expectArray(data, 'versões do documento').map((item) =>
    normalizeDocumentVersion(item as Record<string, unknown>)
  )
}

export async function getDocumentVersionDetail(
  documentId: string,
  versionId: string
): Promise<DocumentVersion> {
  const data = await apiGet<unknown>(
    `/webhook/documents/versions/detail?documentId=${encodeURIComponent(
      documentId
    )}&versionId=${encodeURIComponent(versionId)}`
  )
  const version = parseDocumentVersion(data)
  if (!version) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Resposta inválida ao carregar versão do documento',
    })
  }
  return version
}

export async function restoreDocumentVersion(
  documentId: string,
  versionId: string
): Promise<Document> {
  const result = await apiPost<unknown>('/webhook/documents/versions/restore', {
    documentId,
    versionId,
  })

  const parsed = parseDocument(result)
  if (parsed) return parsed

  return resolveDocumentAfterUpdate(result, documentId)
}

export async function downloadDocumentVersion(
  documentId: string,
  versionId: string,
  fileName?: string
): Promise<void> {
  const { blob, fileName: downloadedFileName } = await apiDownload(
    `/webhook/documents/versions/download?documentId=${encodeURIComponent(
      documentId
    )}&versionId=${encodeURIComponent(versionId)}`
  )

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = downloadedFileName ?? fileName ?? 'documento'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export interface DocumentOcrResult {
  ok: boolean
  documentId?: string
  versionId?: string
  ocrStatus?: string | null
  extractionMethod?: string | null
  ocrEngine?: string | null
  ocrLanguages?: string | null
  ocrDurationMs?: number | null
  ocrAttempts?: number | null
  code?: string | null
  message?: string | null
}

export async function runDocumentOcr(
  documentId: string,
  options?: { versionId?: string; force?: boolean }
): Promise<DocumentOcrResult> {
  const data = await apiPost<unknown>('/webhook/documents/ocr', {
    documentId,
    versionId: options?.versionId ?? null,
    force: options?.force ?? true,
  })

  const record =
    data && typeof data === 'object'
      ? ((data as Record<string, unknown>).data as Record<string, unknown> | undefined) ??
        (data as Record<string, unknown>)
      : null

  if (!record || typeof record !== 'object') {
    return { ok: false, code: 'INTERNAL_ERROR', message: 'Resposta inválida do OCR.' }
  }

  return {
    ok: record.ok === true,
    documentId: pickString(record, 'documentId', 'document_id') ?? documentId,
    versionId: pickString(record, 'versionId', 'version_id') ?? undefined,
    ocrStatus: pickString(record, 'ocrStatus', 'ocr_status'),
    extractionMethod: pickString(record, 'extractionMethod', 'extraction_method'),
    ocrEngine: pickString(record, 'ocrEngine', 'ocr_engine'),
    ocrLanguages: pickString(record, 'ocrLanguages', 'ocr_languages'),
    ocrDurationMs: pickNumber(record, 'ocrDurationMs', 'ocr_duration_ms'),
    ocrAttempts: pickNumber(record, 'ocrAttempts', 'ocr_attempts'),
    code: pickString(record, 'code'),
    message: pickString(record, 'message'),
  }
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
