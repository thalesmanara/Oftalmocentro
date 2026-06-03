import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Permission, User } from '@/types'
import { authenticate } from '@/services/usersService'
import { logAction } from '@/services/auditService'
import { getSectors } from '@/services/sectorsService'

const AUTH_KEY = 'oftalmocentro_auth'

interface AuthContextValue {
  user: User | null
  sectorName: string
  loading: boolean
  login: (email: string, senha: string) => Promise<boolean>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
  updateCurrentUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function loadStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadStoredUser)
  const [sectorName, setSectorName] = useState('')
  const [loading, setLoading] = useState(false)

  const resolveSector = useCallback(async (setorId: string) => {
    const sectors = await getSectors()
    const sector = sectors.find((s) => s.id === setorId)
    setSectorName(sector?.nome ?? '—')
  }, [])

  useEffect(() => {
    if (user) void resolveSector(user.setorId)
  }, [user, resolveSector])

  const login = useCallback(
    async (email: string, senha: string) => {
      setLoading(true)
      try {
        const authenticated = await authenticate(email, senha)
        if (!authenticated) return false
        setUser(authenticated)
        sessionStorage.setItem(AUTH_KEY, JSON.stringify(authenticated))
        await resolveSector(authenticated.setorId)
        logAction(authenticated.nome, 'Login', 'Sessão', 'Login realizado com sucesso')
        return true
      } finally {
        setLoading(false)
      }
    },
    [resolveSector]
  )

  const logout = useCallback(() => {
    if (user) {
      logAction(user.nome, 'Logout', 'Sessão', 'Logout realizado')
    }
    setUser(null)
    setSectorName('')
    sessionStorage.removeItem(AUTH_KEY)
  }, [user])

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false
      return user.permissoes.includes(permission)
    },
    [user]
  )

  const updateCurrentUser = useCallback(
    (updated: User) => {
      setUser(updated)
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(updated))
      void resolveSector(updated.setorId)
    },
    [resolveSector]
  )

  const value = useMemo(
    () => ({
      user,
      sectorName,
      loading,
      login,
      logout,
      hasPermission,
      updateCurrentUser,
    }),
    [user, sectorName, loading, login, logout, hasPermission, updateCurrentUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
