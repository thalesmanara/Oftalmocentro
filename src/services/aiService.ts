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

export interface AIResponseMeta {
  isSummarizedResponse?: boolean
  [key: string]: unknown
}

export interface AIResponse {
  success: boolean
  question?: string
  answer: string
  sources: AISource[]
  classification?: Record<string, unknown>
  isSummarizedResponse?: boolean
  responseMeta?: AIResponseMeta
  policyMeta?: AIResponseMeta
}

const SUMMARY_NOTICE_TEXT =
  'Esta resposta foi resumida devido ao volume de conteúdo relevante encontrado.'

/** `true` quando a API sinaliza que a resposta foi resumida (em qualquer um dos campos suportados). */
export function isSummarizedResponse(response: Pick<AIResponse, 'isSummarizedResponse' | 'responseMeta' | 'policyMeta'>): boolean {
  return Boolean(
    response.isSummarizedResponse ||
      response.responseMeta?.isSummarizedResponse ||
      response.policyMeta?.isSummarizedResponse
  )
}

/** Evita duplicar o aviso quando o próprio texto da resposta já anuncia o resumo. */
export function answerAnnouncesSummary(answer: string): boolean {
  const firstLine = (answer || '').trim().split('\n')[0]?.toLowerCase() ?? ''
  return firstLine.includes('resposta') && firstLine.includes('resumid')
}

export function getSummaryNoticeText(): string {
  return SUMMARY_NOTICE_TEXT
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

function parseResponseMeta(value: unknown): AIResponseMeta | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as AIResponseMeta
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
    isSummarizedResponse:
      record.isSummarizedResponse === true || record.is_summarized_response === true
        ? true
        : undefined,
    responseMeta: parseResponseMeta(record.responseMeta ?? record.response_meta),
    policyMeta: parseResponseMeta(record.policyMeta ?? record.policy_meta),
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
