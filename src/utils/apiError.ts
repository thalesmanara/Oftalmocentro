import { ApiError } from '@/types/api'

/** Mensagens amigáveis para códigos de validação de arquivo (backend). */
const FILE_VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  FILE_REQUIRED: 'Arquivo é obrigatório.',
  FILE_EMPTY: 'O arquivo está vazio.',
  FILE_TOO_LARGE: 'O arquivo ultrapassa o limite permitido de 25 MB.',
  FILE_EXTENSION_NOT_ALLOWED: 'Extensão de arquivo não permitida.',
  FILE_EXTENSION_MISMATCH: 'Nome do arquivo contém extensão inválida ou ambígua.',
  FILE_MIME_MISMATCH: 'O tipo do arquivo não corresponde à extensão informada.',
  FILE_PASSWORD_PROTECTED: 'O arquivo está protegido por senha e não pode ser processado.',
  FILE_CORRUPTED: 'O arquivo parece estar corrompido.',
  FILE_UNREADABLE: 'Não foi possível ler o arquivo enviado.',
  DUPLICATE_FILE: 'Este arquivo já foi enviado anteriormente.',
  INVALID_FILE_NAME: 'Nome do arquivo contém caracteres inválidos.',
  FILE_TYPE_NOT_ALLOWED: 'Tipo de arquivo não permitido.',
  OCR_MANUAL_REVIEW: 'O documento precisa de revisão antes de ficar disponível para consulta.',
  QDRANT_SYNC_FAILED:
    'Não foi possível indexar o documento para consulta. Tente reprocessar ou contate o suporte.',
}

const STATUS_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não possui permissão para acessar esta área.',
  INTERNAL_ERROR:
    'Não foi possível concluir a operação. Tente novamente ou informe o código da solicitação ao suporte.',
  NOT_FOUND: 'O recurso solicitado não foi encontrado.',
  REQUEST_TIMEOUT: 'A solicitação excedeu o tempo limite. Tente novamente.',
  REQUEST_ABORTED: 'Requisição cancelada.',
}

/** Mensagem amigável a partir de erros da API ou genéricos. */
export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  if (error instanceof ApiError) {
    const mapped =
      FILE_VALIDATION_ERROR_MESSAGES[error.code] || STATUS_MESSAGES[error.code]
    let message = mapped || error.message || fallback
    if (
      (error.code === 'INTERNAL_ERROR' || error.status >= 500) &&
      error.requestId &&
      !message.includes(error.requestId)
    ) {
      message = `${message} Código da solicitação: ${error.requestId}`
    }
    return message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}
