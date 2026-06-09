import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/hooks/useSettings'
import { AppRoutes } from '@/routes/AppRoutes'
import { getRouterBasename } from '@/config/app'

export default function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <SettingsProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  )
}
