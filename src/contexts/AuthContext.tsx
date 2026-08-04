import {
  createContext,
  useCallback,
  useEffect,
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
  persistLoginSession,
  persistSession,
  validateSession,
} from '@/services/authService'
import { clearAuthToken, setUnauthorizedHandler } from '@/services/api'
import { hasPermission as checkPermission, canAccessTechnicalAdministration } from '@/utils/permissions'

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permissionCode: PermissionCode) => boolean
  canAccessTechnicalAdministration: boolean
  updateCurrentUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(() => getCurrentUser())
  const [loading, setLoading] = useState(true)

  const clearLocalSession = useCallback(() => {
    clearAuthToken()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearLocalSession()
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true })
      }
    })

    return () => setUnauthorizedHandler(null)
  }, [clearLocalSession, navigate])

  useEffect(() => {
    let cancelled = false

    async function restore() {
      setLoading(true)
      try {
        const validated = await validateSession()
        if (!cancelled) {
          setUser(validated)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const result = await authLogin(email, password)
      persistLoginSession(result)
      setUser(result.user)
      navigate('/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
    navigate('/login', { replace: true })
  }, [user, navigate])

  const hasPermission = useCallback(
    (permissionCode: PermissionCode) => checkPermission(user, permissionCode),
    [user]
  )

  const canAccessTechnical = useMemo(
    () => canAccessTechnicalAdministration(user),
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
      canAccessTechnicalAdministration: canAccessTechnical,
      updateCurrentUser,
    }),
    [user, loading, login, logout, hasPermission, canAccessTechnical, updateCurrentUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
