export type Permission =
  | 'visualizar_documentos'
  | 'cadastrar_documentos'
  | 'editar_documentos'
  | 'excluir_documentos'
  | 'gerenciar_usuarios'
  | 'gerenciar_setores'
  | 'gerenciar_categorias'
  | 'gerenciar_tags'
  | 'visualizar_auditoria'
  | 'editar_configuracoes'
  | 'usar_consulta_ia'

export const ALL_PERMISSIONS: Permission[] = [
  'visualizar_documentos',
  'cadastrar_documentos',
  'editar_documentos',
  'excluir_documentos',
  'gerenciar_usuarios',
  'gerenciar_setores',
  'gerenciar_categorias',
  'gerenciar_tags',
  'visualizar_auditoria',
  'editar_configuracoes',
  'usar_consulta_ia',
]

export const PERMISSION_LABELS: Record<Permission, string> = {
  visualizar_documentos: 'Visualizar documentos',
  cadastrar_documentos: 'Cadastrar documentos',
  editar_documentos: 'Editar documentos',
  excluir_documentos: 'Excluir documentos',
  gerenciar_usuarios: 'Gerenciar usuários',
  gerenciar_setores: 'Gerenciar setores',
  gerenciar_categorias: 'Gerenciar categorias',
  gerenciar_tags: 'Gerenciar tags',
  visualizar_auditoria: 'Visualizar auditoria',
  editar_configuracoes: 'Editar configurações',
  usar_consulta_ia: 'Usar consulta IA',
}

export interface Sector {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
}

export interface Category {
  id: string
  nome: string
  descricao?: string
  ativo: boolean
}

export interface Tag {
  id: string
  nome: string
  cor?: string
  ativo: boolean
}

export interface User {
  id: string
  nome: string
  email: string
  senha?: string
  setorId: string
  ativo: boolean
  permissoes: Permission[]
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  titulo: string
  setor: string
  categoria: string
  descricaoSemantica: string
  tags: string[]
  dataValidade: string | null
  nomeArquivo: string
  tipoArquivo: string
  tamanhoArquivo: number
  caminhoArquivo: string
  textoExtraido: string
  usuarioResponsavel: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
}

export interface SystemSettings {
  systemName: string
  clinicName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
}

export type AuditAction =
  | 'Login'
  | 'Logout'
  | 'Cadastro'
  | 'Edição'
  | 'Exclusão'
  | 'Upload'
  | 'Download'
  | 'Alteração de usuário'
  | 'Alteração de permissões'
  | 'Alteração de configurações'

export interface AuditLog {
  id: string
  dataHora: string
  usuario: string
  acao: AuditAction
  entidade: string
  detalhes: string
  ip: string
}

export interface DocumentFormData {
  titulo: string
  setor: string
  categoria: string
  descricaoSemantica: string
  tags: string[]
  dataValidade: string | null
  arquivo?: File | null
}

export interface UserFormData {
  nome: string
  email: string
  senha: string
  setorId: string
  ativo: boolean
  permissoes: Permission[]
}
