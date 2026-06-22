import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { AuthUser, PermissionCode } from '@/types'
import {
  getCurrentUser,
  login as authLogin,
  logout as authLogout,
  persistSession,
} from '@/services/authService'
import { logAction } from '@/services/auditService'
import { hasPermission as checkPermission } from '@/utils/permissions'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  hasPermission: (permissionCode: PermissionCode) => boolean
  updateCurrentUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser())
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const loggedUser = await authLogin(email, password)
      persistSession(loggedUser)
      setUser(loggedUser)
      logAction(loggedUser.name, 'Login', 'Sessão', 'Login realizado com sucesso')
      navigate('/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const logout = useCallback(() => {
    if (user) {
      logAction(user.name, 'Logout', 'Sessão', 'Logout realizado')
    }
    authLogout()
    setUser(null)
    navigate('/login', { replace: true })
  }, [user, navigate])

  const hasPermission = useCallback(
    (permissionCode: PermissionCode) => checkPermission(user, permissionCode),
    [user]
  )

  const updateCurrentUser = useCallback((updated: AuthUser) => {
    setUser(updated)
    persistSession(updated)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      hasPermission,
      updateCurrentUser,
    }),
    [user, loading, login, logout, hasPermission, updateCurrentUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
