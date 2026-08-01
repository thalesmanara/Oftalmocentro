import { ApiError } from '@/types/api'

/** Mensagem amigável a partir de erros da API ou genéricos. */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof ApiError) {
    return error.message || fallback
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
