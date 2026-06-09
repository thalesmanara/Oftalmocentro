import { API_BASE_URL } from './api'
import { mockPermissions } from '@/data/mocks'
import type { Permission } from '@/types'

export async function getPermissions(): Promise<Permission[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/webhook/permissions`)

    if (!response.ok) {
      throw new Error('Erro ao buscar permissões')
    }

    const data = await response.json()

    if (Array.isArray(data)) {
      return data as Permission[]
    }

    if (data?.data && Array.isArray(data.data)) {
      return data.data as Permission[]
    }

    return mockPermissions
  } catch (error) {
    console.warn('Usando permissões mockadas por falha no webhook:', error)
    return mockPermissions
  }
}
