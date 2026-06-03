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

export const INITIAL_SECTORS: Sector[] = [
  { id: '1', nome: 'ADMINISTRAÇÃO', ativo: true },
  { id: '2', nome: 'COMPRAS', ativo: true },
  { id: '3', nome: 'ENFERMAGEM', ativo: true },
  { id: '4', nome: 'EXAMES', ativo: true },
  { id: '5', nome: 'FATURAMENTO', ativo: true },
  { id: '6', nome: 'FINANCEIRO', ativo: true },
  { id: '7', nome: 'MÉDICO', ativo: true },
  { id: '8', nome: 'RECEPÇÃO', ativo: true },
  { id: '9', nome: 'SAME', ativo: true },
  { id: '10', nome: 'TELEATENDIMENTO', ativo: true },
]

export const systemSettings: SystemSettings = {
  systemName: 'Oftalmocentro Inteligente',
  clinicName: 'Oftalmocentro Uberaba',
  logoUrl: '',
  primaryColor: '#0d4f8b',
  secondaryColor: '#1a8fbf',
}

export const MASTER_USER_ID = 'user-master'

export let mockUsers: User[] = [
  {
    id: MASTER_USER_ID,
    nome: 'MASTER',
    email: 'master@oftalmocentro.com.br',
    senha: 'master123',
    setorId: '1',
    ativo: true,
    permissoes: [...ALL_PERMISSIONS],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'user-2',
    nome: 'Ana Silva',
    email: 'ana.silva@oftalmocentro.com.br',
    senha: 'senha123',
    setorId: '8',
    ativo: true,
    permissoes: ['visualizar_documentos', 'cadastrar_documentos'],
    createdAt: '2025-02-01T10:00:00Z',
    updatedAt: '2025-02-01T10:00:00Z',
  },
  {
    id: 'user-3',
    nome: 'Carlos Mendes',
    email: 'carlos.mendes@oftalmocentro.com.br',
    senha: 'senha123',
    setorId: '7',
    ativo: true,
    permissoes: ['visualizar_documentos', 'editar_documentos'],
    createdAt: '2025-02-10T10:00:00Z',
    updatedAt: '2025-02-10T10:00:00Z',
  },
]

export let mockSectors: Sector[] = [...INITIAL_SECTORS]

export let mockCategories: Category[] = [
  { id: 'cat-1', nome: 'Protocolos Clínicos', descricao: 'Protocolos e fluxos clínicos', ativo: true },
  { id: 'cat-2', nome: 'Manuais Administrativos', descricao: 'Procedimentos administrativos', ativo: true },
  { id: 'cat-3', nome: 'Normas Regulatórias', descricao: 'Conformidade e regulamentação', ativo: true },
  { id: 'cat-4', nome: 'Treinamentos', descricao: 'Materiais de capacitação', ativo: true },
]

export let mockTags: Tag[] = [
  { id: 'tag-1', nome: 'urgente', cor: '#dc2626', ativo: true },
  { id: 'tag-2', nome: 'interno', cor: '#2563eb', ativo: true },
  { id: 'tag-3', nome: 'LGPD', cor: '#7c3aed', ativo: true },
  { id: 'tag-4', nome: 'revisão-anual', cor: '#059669', ativo: true },
]

const now = new Date()
const expired = new Date(now)
expired.setMonth(expired.getMonth() - 2)
const validFuture = new Date(now)
validFuture.setFullYear(validFuture.getFullYear() + 1)

export let mockDocuments: Document[] = [
  {
    id: 'doc-1',
    titulo: 'Protocolo de Triagem Oftalmológica',
    setor: 'ENFERMAGEM',
    categoria: 'Protocolos Clínicos',
    descricaoSemantica: 'Fluxo de triagem para pacientes com queixa visual aguda.',
    tags: ['urgente', 'interno'],
    dataValidade: validFuture.toISOString().split('T')[0],
    nomeArquivo: 'protocolo-triagem.pdf',
    tipoArquivo: 'application/pdf',
    tamanhoArquivo: 245760,
    caminhoArquivo: '/uploads/protocolo-triagem.pdf',
    textoExtraido: 'Protocolo de triagem oftalmológica para atendimento prioritário...',
    usuarioResponsavel: 'Ana Silva',
    createdAt: '2025-03-01T14:30:00Z',
    updatedAt: '2025-03-01T14:30:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-2',
    titulo: 'Manual de Faturamento TISS',
    setor: 'FATURAMENTO',
    categoria: 'Manuais Administrativos',
    descricaoSemantica: 'Procedimentos de faturamento e envio TISS.',
    tags: ['interno', 'revisão-anual'],
    dataValidade: expired.toISOString().split('T')[0],
    nomeArquivo: 'manual-faturamento.docx',
    tipoArquivo: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    tamanhoArquivo: 512000,
    caminhoArquivo: '/uploads/manual-faturamento.docx',
    textoExtraido: 'Manual de faturamento TISS versão 2024...',
    usuarioResponsavel: 'MASTER',
    createdAt: '2024-11-15T09:00:00Z',
    updatedAt: '2025-01-20T11:00:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-3',
    titulo: 'Política de Privacidade e LGPD',
    setor: 'ADMINISTRAÇÃO',
    categoria: 'Normas Regulatórias',
    descricaoSemantica: 'Política interna de proteção de dados dos pacientes.',
    tags: ['LGPD', 'interno'],
    dataValidade: validFuture.toISOString().split('T')[0],
    nomeArquivo: 'politica-lgpd.pdf',
    tipoArquivo: 'application/pdf',
    tamanhoArquivo: 189440,
    caminhoArquivo: '/uploads/politica-lgpd.pdf',
    textoExtraido: 'Política de privacidade conforme LGPD...',
    usuarioResponsavel: 'MASTER',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-02-28T16:45:00Z',
    createdBy: MASTER_USER_ID,
    updatedBy: MASTER_USER_ID,
  },
  {
    id: 'doc-4',
    titulo: 'Checklist Pré-Operatório',
    setor: 'MÉDICO',
    categoria: 'Protocolos Clínicos',
    descricaoSemantica: 'Checklist para preparação de cirurgias oftalmológicas.',
    tags: ['urgente'],
    dataValidade: null,
    nomeArquivo: 'checklist-pre-op.xlsx',
    tipoArquivo: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    tamanhoArquivo: 98304,
    caminhoArquivo: '/uploads/checklist-pre-op.xlsx',
    textoExtraido: 'Checklist pré-operatório cirurgia oftalmológica...',
    usuarioResponsavel: 'Carlos Mendes',
    createdAt: '2025-04-05T10:15:00Z',
    updatedAt: '2025-04-05T10:15:00Z',
    createdBy: 'user-3',
    updatedBy: 'user-3',
  },
  {
    id: 'doc-5',
    titulo: 'Fluxo de Teleatendimento',
    setor: 'TELEATENDIMENTO',
    categoria: 'Treinamentos',
    descricaoSemantica: 'Orientações para consultas por telemedicina.',
    tags: ['interno'],
    dataValidade: validFuture.toISOString().split('T')[0],
    nomeArquivo: 'fluxo-teleatendimento.pdf',
    tipoArquivo: 'application/pdf',
    tamanhoArquivo: 327680,
    caminhoArquivo: '/uploads/fluxo-teleatendimento.pdf',
    textoExtraido: 'Fluxo de atendimento por telemedicina oftalmológica...',
    usuarioResponsavel: 'Ana Silva',
    createdAt: '2025-05-12T13:00:00Z',
    updatedAt: '2025-05-12T13:00:00Z',
    createdBy: 'user-2',
    updatedBy: 'user-2',
  },
]

export let mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    dataHora: '2025-06-01T08:00:00Z',
    usuario: 'MASTER',
    acao: 'Login',
    entidade: 'Sessão',
    detalhes: 'Login realizado com sucesso',
    ip: '192.168.1.10',
  },
  {
    id: 'audit-2',
    dataHora: '2025-05-12T13:00:00Z',
    usuario: 'Ana Silva',
    acao: 'Upload',
    entidade: 'Documento',
    detalhes: 'Documento "Fluxo de Teleatendimento" enviado',
    ip: '192.168.1.25',
  },
  {
    id: 'audit-3',
    dataHora: '2025-04-05T10:15:00Z',
    usuario: 'Carlos Mendes',
    acao: 'Cadastro',
    entidade: 'Documento',
    detalhes: 'Documento "Checklist Pré-Operatório" cadastrado',
    ip: '192.168.1.30',
  },
  {
    id: 'audit-4',
    dataHora: '2025-02-28T16:45:00Z',
    usuario: 'MASTER',
    acao: 'Edição',
    entidade: 'Documento',
    detalhes: 'Política de Privacidade e LGPD atualizada',
    ip: '192.168.1.10',
  },
  {
    id: 'audit-5',
    dataHora: '2025-02-15T11:30:00Z',
    usuario: 'MASTER',
    acao: 'Alteração de permissões',
    entidade: 'Usuário',
    detalhes: 'Permissões de Ana Silva atualizadas',
    ip: '192.168.1.10',
  },
  {
    id: 'audit-6',
    dataHora: '2025-01-20T09:00:00Z',
    usuario: 'MASTER',
    acao: 'Alteração de configurações',
    entidade: 'Sistema',
    detalhes: 'Cores do sistema atualizadas',
    ip: '192.168.1.10',
  },
]

export let mockSettings: SystemSettings = { ...systemSettings }
