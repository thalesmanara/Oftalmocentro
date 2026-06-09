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
import { getSettings } from '@/services/settingsService'
import { systemSettings as defaultSettings } from '@/data/mocks'

interface SettingsContextValue {
  settings: SystemSettings
  refreshSettings: () => Promise<void>
  applySettings: (s: SystemSettings) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings)

  const refreshSettings = useCallback(async () => {
    const data = await getSettings()
    setSettings(data)
  }, [])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', settings.primaryColor)
    document.documentElement.style.setProperty(
      '--color-secondary',
      settings.secondaryColor ?? '#1a8fbf'
    )
  }, [settings.primaryColor, settings.secondaryColor])

  const value = useMemo(
    () => ({
      settings,
      refreshSettings,
      applySettings: setSettings,
    }),
    [settings, refreshSettings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider')
  return ctx
}
