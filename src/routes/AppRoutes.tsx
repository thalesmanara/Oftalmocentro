import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentLibraryPage } from '@/pages/DocumentLibraryPage'
import { DocumentUploadPage } from '@/pages/DocumentUploadPage'
import { DocumentDetailPage } from '@/pages/DocumentDetailPage'
import { DocumentEditPage } from '@/pages/DocumentEditPage'
import { UsersPage } from '@/pages/UsersPage'
import { SectorsPage } from '@/pages/SectorsPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { AuditPage } from '@/pages/AuditPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MyAccountPage } from '@/pages/MyAccountPage'
import { ConsultaIAPage } from '@/pages/ConsultaIAPage'
import { AiValidationPage } from '@/pages/AiValidationPage'
import { AiPromptsPage } from '@/pages/AiPromptsPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route element={<ProtectedRoute permission="visualizar_documentos" />}>
            <Route path="documentos" element={<DocumentLibraryPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="cadastrar_documentos" />}>
            <Route path="documentos/novo" element={<DocumentUploadPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute anyPermission={['visualizar_documentos', 'cadastrar_documentos']} />
            }
          >
            <Route path="documentos/:id" element={<DocumentDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="editar_documentos" />}>
            <Route path="documentos/:id/editar" element={<DocumentEditPage />} />
          </Route>          <Route element={<ProtectedRoute permission="gerenciar_usuarios" />}>
            <Route path="usuarios" element={<UsersPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="gerenciar_setores" />}>
            <Route path="setores" element={<SectorsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="gerenciar_categorias" />}>
            <Route path="categorias" element={<CategoriesPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="usar_consulta_ia" />}>
            <Route path="consulta-ia" element={<ConsultaIAPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="editar_configuracoes" />}>
            <Route path="ia/validacao" element={<AiValidationPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="editar_configuracoes" />}>
            <Route path="ia/prompts" element={<AiPromptsPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="visualizar_auditoria" />}>
            <Route path="auditoria" element={<AuditPage />} />
          </Route>
          <Route element={<ProtectedRoute permission="editar_configuracoes" />}>
            <Route path="configuracoes" element={<SettingsPage />} />
          </Route>
          <Route path="minha-conta" element={<MyAccountPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
