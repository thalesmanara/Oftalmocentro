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
import { VISUAL_SETTINGS_DEFAULTS } from '@/config/settingsDefaults'
import { getErrorMessage } from '@/utils/apiError'

export type SettingsSource = 'default' | 'api'

interface SettingsContextValue {
  settings: SystemSettings
  /** Origem dos settings exibidos: default visual vs API. */
  settingsSource: SettingsSource
  loading: boolean
  /** Erro do último GET settings (não mascara falha). */
  loadError: string | null
  refreshSettings: () => Promise<void>
  applySettings: (s: SystemSettings) => void
  updateSettings: (data: SystemSettings) => Promise<SystemSettings>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(VISUAL_SETTINGS_DEFAULTS)
  const [settingsSource, setSettingsSource] = useState<SettingsSource>('default')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getSettings()
      setSettings(data)
      setSettingsSource('api')
    } catch (err) {
      // Mantém default visual / último valor conhecido. Não injeta dados corporativos fictícios.
      setLoadError(getErrorMessage(err, 'Não foi possível carregar as configurações.'))
      if (settingsSource !== 'api') {
        setSettings(VISUAL_SETTINGS_DEFAULTS)
        setSettingsSource('default')
      }
    } finally {
      setLoading(false)
    }
  }, [settingsSource])

  const updateSettings = useCallback(async (data: SystemSettings) => {
    const updated = await updateSettingsService(data)
    setSettings(updated)
    setSettingsSource('api')
    setLoadError(null)
    return updated
  }, [])

  useEffect(() => {
    void refreshSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial única
  }, [])

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
      settingsSource,
      loading,
      loadError,
      refreshSettings,
      applySettings: (s: SystemSettings) => {
        setSettings(s)
        setSettingsSource('api')
      },
      updateSettings,
    }),
    [settings, settingsSource, loading, loadError, refreshSettings, updateSettings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider')
  return ctx
}
