import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser, Permission } from '@/types'
import {
  getCurrentUser,
  getToken,
  login as authLogin,
  logout as authLogout,
  persistSession,
} from '@/services/authService'
import { logAction } from '@/services/auditService'

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
  updateCurrentUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser())
  const [token, setToken] = useState<string | null>(() => getToken())
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const result = await authLogin(email, password)
      if (!result) return false

      persistSession(result.user, result.token)
      setUser(result.user)
      setToken(result.token)
      logAction(result.user.name, 'Login', 'Sessão', 'Login realizado com sucesso')
      return true
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    if (user) {
      logAction(user.name, 'Logout', 'Sessão', 'Logout realizado')
    }
    authLogout()
    setUser(null)
    setToken(null)
    navigate('/login', { replace: true })
  }, [user, navigate])

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false
      return user.permissions.includes(permission)
    },
    [user]
  )

  const updateCurrentUser = useCallback((updated: AuthUser) => {
    setUser(updated)
    const currentToken = getToken()
    if (currentToken) {
      persistSession(updated, currentToken)
    } else {
      localStorage.setItem('user', JSON.stringify(updated))
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      hasPermission,
      updateCurrentUser,
    }),
    [user, token, loading, login, logout, hasPermission, updateCurrentUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
