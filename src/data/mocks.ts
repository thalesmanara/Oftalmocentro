import type {
  Category,
  Document,
  Permission,
  Sector,
  Subcategory,
  SystemSettings,
  User,
} from '@/types'

const ts = () => new Date().toISOString()

export const MOCK_SECTOR_ADMIN = 'mock-sector-administracao'
export const MOCK_SECTOR_COMPRAS = 'mock-sector-compras'
export const MOCK_SECTOR_ENFERMAGEM = 'mock-sector-enfermagem'
export const MOCK_SECTOR_EXAMES = 'mock-sector-exames'
export const MOCK_SECTOR_FATURAMENTO = 'mock-sector-faturamento'
export const MOCK_SECTOR_FINANCEIRO = 'mock-sector-financeiro'
export const MOCK_SECTOR_MEDICO = 'mock-sector-medico'
export const MOCK_SECTOR_RECEPCAO = 'mock-sector-recepcao'
export const MOCK_SECTOR_SAME = 'mock-sector-same'
export const MOCK_SECTOR_TELE = 'mock-sector-teleatendimento'

export const INITIAL_SECTORS: Sector[] = [
  { id: MOCK_SECTOR_ADMIN, name: 'ADMINISTRAÇÃO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_COMPRAS, name: 'COMPRAS', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_ENFERMAGEM, name: 'ENFERMAGEM', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_EXAMES, name: 'EXAMES', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_FATURAMENTO, name: 'FATURAMENTO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_FINANCEIRO, name: 'FINANCEIRO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_MEDICO, name: 'MÉDICO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_RECEPCAO, name: 'RECEPÇÃO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_SAME, name: 'SAME', description: null, active: true, createdAt: ts(), updatedAt: ts() },
  { id: MOCK_SECTOR_TELE, name: 'TELEATENDIMENTO', description: null, active: true, createdAt: ts(), updatedAt: ts() },
]

export const mockSystemSettings: SystemSettings = {
  id: 'mock-settings',
  systemName: 'Oftalmocentro Inteligente',
  clinicName: 'Oftalmocentro Uberaba',
  logoUrl: null,
  primaryColor: '#1e3a8a',
  secondaryColor: '#0f172a',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export let mockPermissions: Permission[] = [
  { id: 'mock-permission-visualizar-documentos', code: 'visualizar_documentos', name: 'Visualizar documentos' },
  { id: 'mock-permission-cadastrar-documentos', code: 'cadastrar_documentos', name: 'Cadastrar documentos' },
  { id: 'mock-permission-editar-documentos', code: 'editar_documentos', name: 'Editar documentos' },
  { id: 'mock-permission-excluir-documentos', code: 'excluir_documentos', name: 'Excluir documentos' },
  { id: 'mock-permission-gerenciar-usuarios', code: 'gerenciar_usuarios', name: 'Gerenciar usuários' },
  { id: 'mock-permission-gerenciar-setores', code: 'gerenciar_setores', name: 'Gerenciar setores' },
  { id: 'mock-permission-gerenciar-categorias', code: 'gerenciar_categorias', name: 'Gerenciar categorias' },
  { id: 'mock-permission-visualizar-auditoria', code: 'visualizar_auditoria', name: 'Visualizar auditoria' },
  { id: 'mock-permission-editar-configuracoes', code: 'editar_configuracoes', name: 'Editar configurações' },
  { id: 'mock-permission-usar-consulta-ia', code: 'usar_consulta_ia', name: 'Usar consulta IA' },
]

export const ALL_PERMISSION_CODES = mockPermissions.map((p) => p.code)

export const MASTER_USER_ID = 'mock-master'

/** Senhas mockadas — apenas para camada de serviço local, não expostas no tipo User */
export const mockUserPasswords: Record<string, string> = {
  [MASTER_USER_ID]: 'admin123',
}

export let mockUsers: User[] = [
  {
    id: 'mock-master',
    name: 'Administrador',
    email: 'admin@oftalmocentro.cloud',
    sectorId: MOCK_SECTOR_ADMIN,
    sectorName: 'ADMINISTRAÇÃO',
    active: true,
    isMaster: true,
    permissions: mockPermissions.map((permission) => permission.code),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export let mockSectors: Sector[] = [...INITIAL_SECTORS]

export const MOCK_CATEGORY_MANUAL = 'mock-category-manual'
export const MOCK_CATEGORY_PROTOCOLOS = 'mock-category-protocolos'
export const MOCK_CATEGORY_MANUAIS = 'mock-category-manuais'
export const MOCK_CATEGORY_NORMAS = 'mock-category-normas'
export const MOCK_CATEGORY_TREINAMENTOS = 'mock-category-treinamentos'

export let mockCategories: Category[] = [
  {
    id: MOCK_CATEGORY_MANUAL,
    name: 'Manual',
    description: 'Manuais internos',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_CATEGORY_PROTOCOLOS,
    name: 'Protocolos Clínicos',
    description: 'Protocolos e fluxos clínicos',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_CATEGORY_MANUAIS,
    name: 'Manuais Administrativos',
    description: 'Procedimentos administrativos',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_CATEGORY_NORMAS,
    name: 'Normas Regulatórias',
    description: 'Conformidade e regulamentação',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_CATEGORY_TREINAMENTOS,
    name: 'Treinamentos',
    description: 'Materiais de capacitação',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
]

export const MOCK_SUBCATEGORY_TRIAGEM = 'mock-subcategory-triagem'
export const MOCK_SUBCATEGORY_FATURAMENTO = 'mock-subcategory-faturamento'
export const MOCK_SUBCATEGORY_LGPD = 'mock-subcategory-lgpd'
export const MOCK_SUBCATEGORY_CIRURGIA = 'mock-subcategory-cirurgia'
export const MOCK_SUBCATEGORY_TELE = 'mock-subcategory-tele'

export let mockSubcategories: Subcategory[] = [
  {
    id: MOCK_SUBCATEGORY_TRIAGEM,
    categoryId: MOCK_CATEGORY_PROTOCOLOS,
    categoryName: 'Protocolos Clínicos',
    name: 'Triagem',
    description: 'Protocolos de triagem e acolhimento',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_SUBCATEGORY_CIRURGIA,
    categoryId: MOCK_CATEGORY_PROTOCOLOS,
    categoryName: 'Protocolos Clínicos',
    name: 'Cirurgia',
    description: 'Checklists e protocolos cirúrgicos',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_SUBCATEGORY_FATURAMENTO,
    categoryId: MOCK_CATEGORY_MANUAIS,
    categoryName: 'Manuais Administrativos',
    name: 'Faturamento',
    description: 'Manuais de faturamento e TISS',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_SUBCATEGORY_LGPD,
    categoryId: MOCK_CATEGORY_NORMAS,
    categoryName: 'Normas Regulatórias',
    name: 'LGPD',
    description: 'Normas de proteção de dados',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: MOCK_SUBCATEGORY_TELE,
    categoryId: MOCK_CATEGORY_TREINAMENTOS,
    categoryName: 'Treinamentos',
    name: 'Telemedicina',
    description: 'Materiais de capacitação em teleatendimento',
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
]

const now = new Date()
const expired = new Date(now)
expired.setMonth(expired.getMonth() - 2)
const validFuture = new Date(now)
validFuture.setFullYear(validFuture.getFullYear() + 1)

export let mockDocuments: Document[] = [
  {
    id: 'doc-1',
    title: 'Protocolo de Triagem Oftalmológica',
    sectorId: MOCK_SECTOR_ENFERMAGEM,
    sectorName: 'ENFERMAGEM',
    categoryId: MOCK_CATEGORY_PROTOCOLOS,
    categoryName: 'Protocolos Clínicos',
    subcategoryId: MOCK_SUBCATEGORY_TRIAGEM,
    subcategoryName: 'Triagem',
    semanticDescription: 'Fluxo de triagem para pacientes com queixa visual aguda.',
    expirationDate: validFuture.toISOString().split('T')[0],
    fileName: 'protocolo-triagem.pdf',
    fileType: 'application/pdf',
    fileSize: 245760,
    filePath: '/uploads/protocolo-triagem.pdf',
    extractedText: 'Protocolo de triagem oftalmológica para atendimento prioritário...',
    responsibleUserName: 'Ana Silva',
    createdAt: '2025-03-01T14:30:00Z',
    updatedAt: '2025-03-01T14:30:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-2',
    title: 'Manual de Faturamento TISS',
    sectorId: MOCK_SECTOR_FATURAMENTO,
    sectorName: 'FATURAMENTO',
    categoryId: MOCK_CATEGORY_MANUAIS,
    categoryName: 'Manuais Administrativos',
    subcategoryId: MOCK_SUBCATEGORY_FATURAMENTO,
    subcategoryName: 'Faturamento',
    semanticDescription: 'Procedimentos de faturamento e envio TISS.',
    expirationDate: expired.toISOString().split('T')[0],
    fileName: 'manual-faturamento.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileSize: 512000,
    filePath: '/uploads/manual-faturamento.docx',
    extractedText: 'Manual de faturamento TISS versão 2024...',
    responsibleUserName: 'MASTER',
    createdAt: '2024-11-15T09:00:00Z',
    updatedAt: '2025-01-20T11:00:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-3',
    title: 'Política de Privacidade e LGPD',
    sectorId: MOCK_SECTOR_ADMIN,
    sectorName: 'ADMINISTRAÇÃO',
    categoryId: MOCK_CATEGORY_NORMAS,
    categoryName: 'Normas Regulatórias',
    subcategoryId: MOCK_SUBCATEGORY_LGPD,
    subcategoryName: 'LGPD',
    semanticDescription: 'Política interna de proteção de dados dos pacientes.',
    expirationDate: validFuture.toISOString().split('T')[0],
    fileName: 'politica-lgpd.pdf',
    fileType: 'application/pdf',
    fileSize: 189440,
    filePath: '/uploads/politica-lgpd.pdf',
    extractedText: 'Política de privacidade conforme LGPD...',
    responsibleUserName: 'MASTER',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-02-28T16:45:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-4',
    title: 'Checklist Pré-Operatório',
    sectorId: MOCK_SECTOR_MEDICO,
    sectorName: 'MÉDICO',
    categoryId: MOCK_CATEGORY_PROTOCOLOS,
    categoryName: 'Protocolos Clínicos',
    subcategoryId: MOCK_SUBCATEGORY_CIRURGIA,
    subcategoryName: 'Cirurgia',
    semanticDescription: 'Checklist para preparação de cirurgias oftalmológicas.',
    expirationDate: null,
    fileName: 'checklist-pre-op.xlsx',
    fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileSize: 98304,
    filePath: '/uploads/checklist-pre-op.xlsx',
    extractedText: 'Checklist pré-operatório cirurgia oftalmológica...',
    responsibleUserName: 'Carlos Mendes',
    createdAt: '2025-04-05T10:15:00Z',
    updatedAt: '2025-04-05T10:15:00Z',
    createdBy: 'user-3',
    updatedBy: 'user-3',
  },
  {
    id: 'doc-5',
    title: 'Fluxo de Teleatendimento',
    sectorId: MOCK_SECTOR_TELE,
    sectorName: 'TELEATENDIMENTO',
    categoryId: MOCK_CATEGORY_TREINAMENTOS,
    categoryName: 'Treinamentos',
    subcategoryId: MOCK_SUBCATEGORY_TELE,
    subcategoryName: 'Telemedicina',
    semanticDescription: 'Orientações para consultas por telemedicina.',
    expirationDate: validFuture.toISOString().split('T')[0],
    fileName: 'fluxo-teleatendimento.pdf',
    fileType: 'application/pdf',
    fileSize: 327680,
    filePath: '/uploads/fluxo-teleatendimento.pdf',
    extractedText: 'Fluxo de atendimento por telemedicina oftalmológica...',
    responsibleUserName: 'Ana Silva',
    createdAt: '2025-05-12T13:00:00Z',
    updatedAt: '2025-05-12T13:00:00Z',
    createdBy: 'user-2',
    updatedBy: 'user-2',
  },
]

export let mockSettings: SystemSettings = { ...mockSystemSettings }
