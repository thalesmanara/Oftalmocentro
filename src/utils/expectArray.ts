import { ApiError } from '@/types/api'

/** Após resposta OK da API: exige array real. Não mascara formato inválido como lista vazia. */
export function expectArray(data: unknown, resourceLabel: string): unknown[] {
  if (data == null) return []
  if (Array.isArray(data)) return data
  throw new ApiError({
    status: 500,
    code: 'INVALID_RESPONSE',
    message: `Resposta inválida ao carregar ${resourceLabel}.`,
  })
}
