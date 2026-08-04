import { ApiError, apiPost } from './api'

export interface AISource {
  index: number
  documentId: string
  documentTitle: string
  sectorName?: string
  categoryName?: string
  subcategoryName?: string
  chunkOrder?: number
  expirationDate?: string | null
}

export interface AIResponse {
  success: boolean
  question?: string
  answer: string
  sources: AISource[]
  classification?: Record<string, unknown>
}

function parseSource(data: unknown): AISource | null {
  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  const documentId = String(record.documentId ?? record.document_id ?? '')
  const documentTitle = String(record.documentTitle ?? record.document_title ?? '')

  if (!documentId && !documentTitle) return null

  return {
    index: Number(record.index ?? 0),
    documentId,
    documentTitle,
    sectorName: record.sectorName != null ? String(record.sectorName) : undefined,
    categoryName: record.categoryName != null ? String(record.categoryName) : undefined,
    subcategoryName:
      record.subcategoryName != null
        ? String(record.subcategoryName)
        : record.subcategory_name != null
          ? String(record.subcategory_name)
          : undefined,
    chunkOrder:
      record.chunkOrder != null
        ? Number(record.chunkOrder)
        : record.chunk_order != null
          ? Number(record.chunk_order)
          : undefined,
    expirationDate:
      record.expirationDate != null
        ? String(record.expirationDate)
        : record.expiration_date != null
          ? String(record.expiration_date)
          : undefined,
  }
}

function parseAIResponse(data: unknown): AIResponse | null {
  if (!data || typeof data !== 'object') return null

  const record = data as Record<string, unknown>
  const answer = record.answer != null ? String(record.answer) : ''
  const sources = Array.isArray(record.sources)
    ? record.sources.map(parseSource).filter((item): item is AISource => Boolean(item))
    : []

  return {
    success: true,
    question: record.question != null ? String(record.question) : undefined,
    answer,
    sources,
    classification:
      record.classification && typeof record.classification === 'object'
        ? (record.classification as Record<string, unknown>)
        : undefined,
  }
}

export async function askAI(question: string): Promise<AIResponse> {
  const trimmed = question.trim()
  if (!trimmed) {
    throw new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Digite uma pergunta antes de consultar a IA.',
    })
  }

  const data = await apiPost<unknown>(
    '/webhook/consulta-ia',
    { question: trimmed },
    { timeoutMs: 120_000 },
  )

  const parsed = parseAIResponse(data)
  if (!parsed) {
    throw new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Não foi possível consultar a IA no momento. Tente novamente.',
    })
  }

  return parsed
}
