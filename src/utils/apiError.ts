import { ApiError } from '@/types/api'

/** Mensagens amigáveis para códigos de validação de arquivo (backend). */
const FILE_VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  FILE_REQUIRED: 'Arquivo é obrigatório.',
  FILE_EMPTY: 'O arquivo está vazio.',
  FILE_TOO_LARGE: 'O arquivo excede o tamanho máximo permitido (25 MB).',
  FILE_EXTENSION_NOT_ALLOWED: 'Extensão de arquivo não permitida.',
  FILE_EXTENSION_MISMATCH: 'Nome do arquivo contém extensão inválida ou ambígua.',
  FILE_MIME_MISMATCH: 'O tipo do arquivo não corresponde à extensão informada.',
  FILE_PASSWORD_PROTECTED: 'Arquivo protegido por senha não é permitido.',
  FILE_CORRUPTED: 'O arquivo parece estar corrompido.',
  FILE_UNREADABLE: 'Não foi possível ler o arquivo enviado.',
  DUPLICATE_FILE: 'Este arquivo já foi enviado anteriormente.',
  INVALID_FILE_NAME: 'Nome do arquivo contém caracteres inválidos.',
  FILE_TYPE_NOT_ALLOWED: 'Tipo de arquivo não permitido.',
}

/** Mensagem amigável a partir de erros da API ou genéricos. */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof ApiError) {
    const mapped = FILE_VALIDATION_ERROR_MESSAGES[error.code]
    if (mapped) return mapped
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
