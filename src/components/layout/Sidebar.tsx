import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Library,
  Upload,
  Users,
  Building2,
  FolderOpen,
  Bot,
  ClipboardList,
  Settings,
  FlaskConical,
  ScrollText,
  Database,
  SlidersHorizontal,
  Layers,
  HardDrive,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import type { PermissionCode } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission?: PermissionCode
}

interface NavGroup {
  title?: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'DOCUMENTOS',
    items: [
      { to: '/documentos', label: 'Biblioteca', icon: Library, permission: 'visualizar_documentos' },
      { to: '/documentos/novo', label: 'Upload', icon: Upload, permission: 'cadastrar_documentos' },
    ],
  },
  {
    title: 'CADASTROS',
    items: [
      { to: '/usuarios', label: 'Usuários', icon: Users, permission: 'gerenciar_usuarios' },
      { to: '/setores', label: 'Setores', icon: Building2, permission: 'gerenciar_setores' },
      { to: '/categorias', label: 'Categorias do documento', icon: FolderOpen, permission: 'gerenciar_categorias' },
    ],
  },
  {
    title: 'SISTEMA',
    items: [
      { to: '/consulta-ia', label: 'Consulta IA', icon: Bot, permission: 'usar_consulta_ia' },
      {
        to: '/ia/validacao',
        label: 'Validação IA',
        icon: FlaskConical,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/prompts',
        label: 'Prompts da IA',
        icon: ScrollText,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/retrieval',
        label: 'Retrieval / Re-ranking',
        icon: SlidersHorizontal,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/contexto',
        label: 'Janela de Contexto',
        icon: Layers,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/cache',
        label: 'Cache da IA',
        icon: HardDrive,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/evidencias',
        label: 'Evidências',
        icon: Fingerprint,
        permission: 'editar_configuracoes',
      },
      {
        to: '/ia/qualidade',
        label: 'Qualidade da Resposta',
        icon: ShieldCheck,
        permission: 'editar_configuracoes',
      },
      {
        to: '/sistema/qdrant',
        label: 'Qdrant',
        icon: Database,
        permission: 'editar_configuracoes',
      },
      { to: '/auditoria', label: 'Auditoria', icon: ClipboardList, permission: 'visualizar_auditoria' },
      { to: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'editar_configuracoes' },
    ],
  },
]

export function Sidebar() {
  const { settings } = useSettings()
  const { hasPermission } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-white/15 text-white'
        : 'text-white/80 hover:bg-white/10 hover:text-white'
    }`

  return (
    <aside
      className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col text-white shadow-lg"
      style={{ backgroundColor: settings.primaryColor }}
    >
      <div className="border-b border-white/10 px-5 py-5">
        {settings.logoUrl ? (
          <img
            src={settings.logoUrl}
            alt={settings.clinicName}
            className="mx-auto h-10 max-w-full object-contain"
          />
        ) : (
          <p className="text-center text-sm font-bold leading-tight">{settings.systemName}</p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'mt-5' : ''}>
            {group.title && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-white/50">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items
                .filter((item) => !item.permission || hasPermission(item.permission))
                .map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} className={linkClass} end={item.to === '/documentos'}>
                      <item.icon size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="truncate text-xs text-white/60">{settings.clinicName}</p>
      </div>
    </aside>
  )
}
