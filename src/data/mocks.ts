import type {
  AuditLog,
  Category,
  Document,
  Sector,
  SystemSettings,
  Tag,
  User,
} from '@/types'
import { ALL_PERMISSIONS } from '@/types'

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

export const systemSettings: SystemSettings = {
  id: 'settings-1',
  systemName: 'Oftalmocentro Inteligente',
  clinicName: 'Oftalmocentro Uberaba',
  logoUrl: null,
  primaryColor: '#0d4f8b',
  secondaryColor: '#1a8fbf',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

export const MASTER_USER_ID = 'user-master'

/** Senhas mockadas — apenas para camada de serviço local, não expostas no tipo User */
export const mockUserPasswords: Record<string, string> = {
  [MASTER_USER_ID]: 'master123',
  'user-2': 'senha123',
  'user-3': 'senha123',
}

export let mockUsers: User[] = [
  {
    id: MASTER_USER_ID,
    name: 'MASTER',
    email: 'master@oftalmocentro.com.br',
    sectorId: MOCK_SECTOR_ADMIN,
    sectorName: 'ADMINISTRAÇÃO',
    active: true,
    isMaster: true,
    permissions: [...ALL_PERMISSIONS],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Ana Silva',
    email: 'ana.silva@oftalmocentro.com.br',
    sectorId: MOCK_SECTOR_RECEPCAO,
    sectorName: 'RECEPÇÃO',
    active: true,
    isMaster: false,
    permissions: ['visualizar_documentos', 'cadastrar_documentos'],
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-01T10:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Carlos Mendes',
    email: 'carlos.mendes@oftalmocentro.com.br',
    sectorId: MOCK_SECTOR_MEDICO,
    sectorName: 'MÉDICO',
    active: true,
    isMaster: false,
    permissions: ['visualizar_documentos', 'editar_documentos'],
    createdAt: '2025-02-10T10:00:00Z',
    updatedAt: '2025-02-10T10:00:00Z',
  },
]

export let mockSectors: Sector[] = [...INITIAL_SECTORS]

export let mockCategories: Category[] = [
  { id: 'cat-1', name: 'Protocolos Clínicos', description: 'Protocolos e fluxos clínicos', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'cat-2', name: 'Manuais Administrativos', description: 'Procedimentos administrativos', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'cat-3', name: 'Normas Regulatórias', description: 'Conformidade e regulamentação', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'cat-4', name: 'Treinamentos', description: 'Materiais de capacitação', active: true, createdAt: ts(), updatedAt: ts() },
]

export let mockTags: Tag[] = [
  { id: 'tag-1', name: 'urgente', color: '#dc2626', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'tag-2', name: 'interno', color: '#2563eb', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'tag-3', name: 'LGPD', color: '#7c3aed', active: true, createdAt: ts(), updatedAt: ts() },
  { id: 'tag-4', name: 'revisão-anual', color: '#059669', active: true, createdAt: ts(), updatedAt: ts() },
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
    categoryId: 'cat-1',
    categoryName: 'Protocolos Clínicos',
    semanticDescription: 'Fluxo de triagem para pacientes com queixa visual aguda.',
    tagIds: ['tag-1', 'tag-2'],
    tags: [
      { id: 'tag-1', name: 'urgente', color: '#dc2626', active: true, createdAt: ts(), updatedAt: ts() },
      { id: 'tag-2', name: 'interno', color: '#2563eb', active: true, createdAt: ts(), updatedAt: ts() },
    ],
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
    categoryId: 'cat-2',
    categoryName: 'Manuais Administrativos',
    semanticDescription: 'Procedimentos de faturamento e envio TISS.',
    tagIds: ['tag-2', 'tag-4'],
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
    categoryId: 'cat-3',
    categoryName: 'Normas Regulatórias',
    semanticDescription: 'Política interna de proteção de dados dos pacientes.',
    tagIds: ['tag-3', 'tag-2'],
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
    categoryId: 'cat-1',
    categoryName: 'Protocolos Clínicos',
    semanticDescription: 'Checklist para preparação de cirurgias oftalmológicas.',
    tagIds: ['tag-1'],
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
    categoryId: 'cat-4',
    categoryName: 'Treinamentos',
    semanticDescription: 'Orientações para consultas por telemedicina.',
    tagIds: ['tag-2'],
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

export let mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    userName: 'MASTER',
    action: 'Login',
    entity: 'Sessão',
    details: 'Login realizado com sucesso',
    ipAddress: '192.168.1.10',
    createdAt: '2025-06-01T08:00:00Z',
  },
  {
    id: 'audit-2',
    userName: 'Ana Silva',
    action: 'Upload',
    entity: 'Documento',
    details: 'Documento "Fluxo de Teleatendimento" enviado',
    ipAddress: '192.168.1.25',
    createdAt: '2025-05-12T13:00:00Z',
  },
  {
    id: 'audit-3',
    userName: 'Carlos Mendes',
    action: 'Cadastro',
    entity: 'Documento',
    details: 'Documento "Checklist Pré-Operatório" cadastrado',
    ipAddress: '192.168.1.30',
    createdAt: '2025-04-05T10:15:00Z',
  },
  {
    id: 'audit-4',
    userName: 'MASTER',
    action: 'Edição',
    entity: 'Documento',
    details: 'Política de Privacidade e LGPD atualizada',
    ipAddress: '192.168.1.10',
    createdAt: '2025-02-28T16:45:00Z',
  },
  {
    id: 'audit-5',
    userName: 'MASTER',
    action: 'Alteração de permissões',
    entity: 'Usuário',
    details: 'Permissões de Ana Silva atualizadas',
    ipAddress: '192.168.1.10',
    createdAt: '2025-02-15T11:30:00Z',
  },
  {
    id: 'audit-6',
    userName: 'MASTER',
    action: 'Alteração de configurações',
    entity: 'Sistema',
    details: 'Cores do sistema atualizadas',
    ipAddress: '192.168.1.10',
    createdAt: '2025-01-20T09:00:00Z',
  },
]

export let mockSettings: SystemSettings = { ...systemSettings }
