import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SystemSettings } from '@/types'
import { getSettings, updateSettings as updateSettingsService } from '@/services/settingsService'
import { mockSystemSettings } from '@/data/mocks'

interface SettingsContextValue {
  settings: SystemSettings
  loading: boolean
  refreshSettings: () => Promise<void>
  applySettings: (s: SystemSettings) => void
  updateSettings: (data: SystemSettings) => Promise<SystemSettings>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/** Defaults visuais iniciais (CSS/login) — não mascaram falha de API nos services. */
const INITIAL_SETTINGS = mockSystemSettings

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(INITIAL_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSettings()
      setSettings(data)
    } catch {
      // Mantém último valor conhecido / defaults visuais; erro não vira mock de domínio.
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (data: SystemSettings) => {
    const updated = await updateSettingsService(data)
    setSettings(updated)
    return updated
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', settings.primaryColor)
    document.documentElement.style.setProperty(
      '--color-secondary',
      settings.secondaryColor ?? '#0f172a'
    )
  }, [settings.primaryColor, settings.secondaryColor])

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings,
      applySettings: setSettings,
      updateSettings,
    }),
    [settings, loading, refreshSettings, updateSettings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider')
  return ctx
}
