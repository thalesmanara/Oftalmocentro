export interface ApiMeta {
  requestId: string
  timestamp: string
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta: ApiMeta
}

export interface ApiErrorBody {
  code: string
  message: string
  fields?: Record<string, string>
}

export interface ApiFailure {
  success: false
  error: ApiErrorBody
  meta: ApiMeta
}

/** Alias histórico — preferir `ApiFailure`. */
export type ApiErrorResponse = ApiFailure

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export class ApiError extends Error {
  status: number
  code: string
  fields?: Record<string, string>
  requestId?: string

  constructor(options: {
    status: number
    code: string
    message: string
    fields?: Record<string, string>
    requestId?: string
  }) {
    super(options.message)
    this.name = 'ApiError'
    this.status = options.status
    this.code = options.code
    this.fields = options.fields
    this.requestId = options.requestId
  }
}

export interface ApiDownloadResult {
  blob: Blob
  fileName: string | null
  contentType: string | null
  requestId: string | null
}
