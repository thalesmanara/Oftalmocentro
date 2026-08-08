/**
 * formatAuditAction / frases gerenciais — Etapa 28.3
 * Códigos no banco permanecem inalterados; só a apresentação muda.
 */
export type AuditActionCategory =
  | 'USUARIOS'
  | 'DOCUMENTOS'
  | 'CATEGORIAS'
  | 'SETORES'
  | 'CONFIGURACOES'
  | 'ACESSO'
  | 'CONSULTA_IA'
  | 'TECNICO'

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  AUTH_LOGIN_SUCCESS: 'entrou no sistema',
  AUTH_LOGIN: 'entrou no sistema',
  AUTH_LOGIN_FAILURE: 'falhou ao entrar no sistema',
  AUTH_LOGOUT: 'saiu do sistema',
  AUTH_CHANGE_PASSWORD: 'alterou a senha',

  USER_CREATE: 'cadastrou um usuário',
  USER_UPDATE: 'editou um usuário',
  USER_DELETE: 'excluiu um usuário',
  USER_INACTIVATE: 'inativou um usuário',
  USER_TECHNICAL_ADMIN_GRANTED: 'concedeu perfil de Administrador Técnico',
  USER_TECHNICAL_ADMIN_REVOKED: 'removeu perfil de Administrador Técnico',
  TECHNICAL_ADMIN_ACCESS_DENIED: 'teve acesso técnico negado',

  DOCUMENT_CREATE: 'cadastrou um documento',
  DOCUMENT_UPDATE: 'editou um documento',
  DOCUMENT_DELETE: 'excluiu um documento',
  DOCUMENT_VERSION_CREATE: 'atualizou a versão de um documento',
  DOCUMENT_ACTIVATED: 'ativou um documento',
  DOCUMENT_DEACTIVATED: 'inativou um documento',
  DOCUMENT_EXPIRATION_CHANGED: 'alterou a vigência de um documento',
  DOCUMENT_UPLOAD: 'enviou um arquivo',
  DOCUMENT_PROCESS: 'processou um documento',
  DOCUMENT_DOWNLOAD: 'baixou um documento',
  DOCUMENT_OCR: 'executou OCR em um documento',
  DOCUMENT_VERSION_DOWNLOAD: 'baixou uma versão de documento',
  DOCUMENT_VERSION_RESTORE: 'restaurou uma versão de documento',

  SECTOR_CREATE: 'cadastrou um setor',
  SECTOR_UPDATE: 'editou um setor',
  SECTOR_INACTIVATE: 'inativou um setor',
  CATEGORY_CREATE: 'cadastrou uma categoria',
  CATEGORY_UPDATE: 'editou uma categoria',
  CATEGORY_INACTIVATE: 'inativou uma categoria',
  SUBCATEGORY_CREATE: 'cadastrou uma subcategoria',
  SUBCATEGORY_UPDATE: 'editou uma subcategoria',
  SUBCATEGORY_INACTIVATE: 'inativou uma subcategoria',
  SETTINGS_UPDATE: 'alterou as configurações',

  AI_QUERY: 'realizou uma consulta à IA',
  AI_RETRIEVAL_STARTED: 'iniciou recuperação de contexto da IA',
  AI_RETRIEVAL_SUCCESS: 'concluiu recuperação de contexto da IA',
  AI_RESPONSE_SUMMARY_WARNING_APPLIED: 'recebeu aviso de resposta resumida',
  AI_RESPONSE_POLICY_APPLIED: 'aplicou política de resposta da IA',
  AI_RESPONSE_POLICY_DECLINE: 'recusou resposta da IA por política',
  AI_RESPONSE_POLICY_ABSTAIN: 'absteve resposta da IA por política',
  AI_RESPONSE_POLICY_WARNING: 'recebeu aviso de política na IA',
  AI_RESPONSE_POLICY_LIMITATION: 'recebeu limitação de política na IA',
  AI_RESPONSE_POLICY_CLARIFICATION: 'recebeu pedido de esclarecimento da IA',

  AI_RETRIEVAL_CONFIG_PUBLISHED: 'publicou configuração de retrieval',
  AI_RETRIEVAL_CONFIG_PUBLISH_OVERRIDE: 'publicou retrieval com override',
  AI_RETRIEVAL_CONFIG_ROLLBACK: 'reverteu configuração de retrieval',
  AI_PROMPT_PUBLISH: 'publicou prompt da IA',
  AI_PROMPT_ROLLBACK: 'reverteu prompt da IA',
  SYSTEM_HEALTH_CHECK: 'consultou o health do sistema',
}

export const AUDIT_ACTION_CATEGORY: Record<string, AuditActionCategory> = {
  AUTH_LOGIN_SUCCESS: 'ACESSO',
  AUTH_LOGIN: 'ACESSO',
  AUTH_LOGIN_FAILURE: 'ACESSO',
  AUTH_LOGOUT: 'ACESSO',
  AUTH_CHANGE_PASSWORD: 'ACESSO',
  USER_CREATE: 'USUARIOS',
  USER_UPDATE: 'USUARIOS',
  USER_DELETE: 'USUARIOS',
  USER_INACTIVATE: 'USUARIOS',
  USER_TECHNICAL_ADMIN_GRANTED: 'USUARIOS',
  USER_TECHNICAL_ADMIN_REVOKED: 'USUARIOS',
  TECHNICAL_ADMIN_ACCESS_DENIED: 'USUARIOS',
  DOCUMENT_CREATE: 'DOCUMENTOS',
  DOCUMENT_UPDATE: 'DOCUMENTOS',
  DOCUMENT_DELETE: 'DOCUMENTOS',
  DOCUMENT_VERSION_CREATE: 'DOCUMENTOS',
  DOCUMENT_ACTIVATED: 'DOCUMENTOS',
  DOCUMENT_DEACTIVATED: 'DOCUMENTOS',
  DOCUMENT_EXPIRATION_CHANGED: 'DOCUMENTOS',
  DOCUMENT_UPLOAD: 'DOCUMENTOS',
  DOCUMENT_PROCESS: 'DOCUMENTOS',
  DOCUMENT_DOWNLOAD: 'DOCUMENTOS',
  DOCUMENT_OCR: 'DOCUMENTOS',
  DOCUMENT_VERSION_DOWNLOAD: 'DOCUMENTOS',
  DOCUMENT_VERSION_RESTORE: 'DOCUMENTOS',
  SECTOR_CREATE: 'SETORES',
  SECTOR_UPDATE: 'SETORES',
  SECTOR_INACTIVATE: 'SETORES',
  CATEGORY_CREATE: 'CATEGORIAS',
  CATEGORY_UPDATE: 'CATEGORIAS',
  CATEGORY_INACTIVATE: 'CATEGORIAS',
  SUBCATEGORY_CREATE: 'CATEGORIAS',
  SUBCATEGORY_UPDATE: 'CATEGORIAS',
  SUBCATEGORY_INACTIVATE: 'CATEGORIAS',
  SETTINGS_UPDATE: 'CONFIGURACOES',
  AI_QUERY: 'CONSULTA_IA',
  AI_RESPONSE_SUMMARY_WARNING_APPLIED: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_APPLIED: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_DECLINE: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_ABSTAIN: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_WARNING: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_LIMITATION: 'CONSULTA_IA',
  AI_RESPONSE_POLICY_CLARIFICATION: 'CONSULTA_IA',
}

export const MANAGERIAL_CATEGORY_OPTIONS: { value: AuditActionCategory | ''; label: string }[] = [
  { value: '', label: 'Todos os módulos' },
  { value: 'ACESSO', label: 'Acesso' },
  { value: 'USUARIOS', label: 'Usuários' },
  { value: 'DOCUMENTOS', label: 'Documentos' },
  { value: 'CATEGORIAS', label: 'Categorias' },
  { value: 'SETORES', label: 'Setores' },
  { value: 'CONFIGURACOES', label: 'Configurações' },
  { value: 'CONSULTA_IA', label: 'Consulta IA' },
]

const TECHNICAL_PREFIXES = [
  'AI_EVIDENCE_',
  'AI_CACHE_',
  'AI_RETRIEVAL_',
  'AI_RERANK_',
  'AI_CONTEXT_',
  'AI_PROMPT_',
  'AI_RESPONSE_VALIDATION_',
  'EMBEDDING_',
  'QDRANT_',
  'OCR_',
  'DATASET_',
  'METRICS_',
  'SYSTEM_',
  'BACKUP_',
]

export function isTechnicalAuditAction(action: string): boolean {
  const a = String(action || '')
  if (AUDIT_ACTION_CATEGORY[a] && AUDIT_ACTION_CATEGORY[a] !== 'TECNICO') {
    // AI_QUERY and policy user-facing stay managerial
    if (a === 'AI_QUERY' || a.startsWith('AI_RESPONSE_POLICY_') || a === 'AI_RESPONSE_SUMMARY_WARNING_APPLIED') {
      return false
    }
  }
  if (a.startsWith('AI_RETRIEVAL_CONFIG_') || a.startsWith('AI_PROMPT_') || a.startsWith('AI_CONTEXT_CONFIG_') || a.startsWith('AI_CACHE_CONFIG_')) {
    return true
  }
  return TECHNICAL_PREFIXES.some((p) => a.startsWith(p))
}

export function getAuditActionCategory(action: string): AuditActionCategory {
  const mapped = AUDIT_ACTION_CATEGORY[action]
  if (mapped) return mapped
  if (isTechnicalAuditAction(action)) return 'TECNICO'
  if (action.startsWith('USER_')) return 'USUARIOS'
  if (action.startsWith('DOCUMENT_')) return 'DOCUMENTOS'
  if (action.startsWith('CATEGORY_') || action.startsWith('SUBCATEGORY_')) return 'CATEGORIAS'
  if (action.startsWith('SECTOR_')) return 'SETORES'
  if (action.startsWith('AUTH_')) return 'ACESSO'
  if (action.startsWith('AI_')) return 'CONSULTA_IA'
  return 'TECNICO'
}

export function formatAuditAction(action: string): string {
  const known = AUDIT_ACTION_LABELS[action]
  if (known) return known
  if (isTechnicalAuditAction(action)) return 'executou uma ação técnica do sistema'
  return 'realizou uma ação no sistema'
}

function pickTitle(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null
  for (const key of ['title', 'name', 'email', 'documentTitle', 'fileName']) {
    const v = data[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

export function formatAuditResourceLabel(log: {
  resourceType?: string | null
  resourceId?: string | null
  afterData?: Record<string, unknown> | null
  beforeData?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}): string | null {
  const title =
    pickTitle(log.afterData) ||
    pickTitle(log.beforeData) ||
    pickTitle(log.metadata) ||
    (typeof log.metadata?.resourceName === 'string' ? log.metadata.resourceName : null)
  if (title) return title
  return null
}

export function formatAuditSentence(log: {
  action: string
  userName?: string | null
  resourceType?: string | null
  resourceId?: string | null
  afterData?: Record<string, unknown> | null
  beforeData?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}): string {
  const who = (log.userName && String(log.userName).trim()) || 'Um usuário'
  const verb = formatAuditAction(log.action)
  const resource = formatAuditResourceLabel(log)

  if (resource && /documento|usuário|setor|categoria|subcategoria/i.test(verb)) {
    // Prefer “cadastrou o documento ‘X’” when verb already includes article+noun
    if (verb.includes('documento')) return `${who} ${verb.replace('um documento', `o documento “${resource}”`)}.`
    if (verb.includes('usuário')) return `${who} ${verb.replace('um usuário', `o usuário “${resource}”`)}.`
    if (verb.includes('setor')) return `${who} ${verb.replace('um setor', `o setor “${resource}”`)}.`
    if (verb.includes('categoria') && !verb.includes('subcategoria')) {
      return `${who} ${verb.replace('uma categoria', `a categoria “${resource}”`)}.`
    }
    if (verb.includes('subcategoria')) {
      return `${who} ${verb.replace('uma subcategoria', `a subcategoria “${resource}”`)}.`
    }
  }

  if (resource && (log.action === 'AI_QUERY' || log.action.startsWith('AI_RESPONSE_POLICY_'))) {
    return `${who} ${verb}.`
  }

  if (resource) return `${who} ${verb}: “${resource}”.`
  return `${who} ${verb}.`
}

export function formatAuditSimpleChange(log: {
  action: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
}): string | null {
  const before = log.beforeData || {}
  const after = log.afterData || {}
  if (log.action === 'DOCUMENT_ACTIVATED' || log.action === 'DOCUMENT_DEACTIVATED') {
    const from = before.isActive === false ? 'Inativo' : before.isActive === true ? 'Ativo' : null
    const to = after.isActive === false ? 'Inativo' : after.isActive === true ? 'Ativo' : null
    if (from && to && from !== to) return `Alterou o documento de ${from} para ${to}.`
  }
  if (log.action === 'DOCUMENT_EXPIRATION_CHANGED' || (before.expirationDate != null || after.expirationDate != null)) {
    const a = before.expirationDate != null ? String(before.expirationDate) : null
    const b = after.expirationDate != null ? String(after.expirationDate) : null
    if (a !== b && (a || b)) {
      return `Alterou a vigência do documento${a ? ` de ${a}` : ''}${b ? ` para ${b}` : ''}.`
    }
  }
  return null
}

/** Actions used in managerial filter select (raw codes still sent to API). */
export function managerialActionFilterOptions(): { value: string; label: string }[] {
  return [
    { value: '', label: 'Todas as ações' },
    { value: 'AUTH_LOGIN_SUCCESS', label: 'Entrada no sistema' },
    { value: 'AUTH_LOGOUT', label: 'Saída do sistema' },
    { value: 'USER_CREATE', label: 'Cadastro de usuário' },
    { value: 'USER_UPDATE', label: 'Edição de usuário' },
    { value: 'DOCUMENT_CREATE', label: 'Cadastro de documento' },
    { value: 'DOCUMENT_UPDATE', label: 'Edição de documento' },
    { value: 'DOCUMENT_ACTIVATED', label: 'Ativação de documento' },
    { value: 'DOCUMENT_DEACTIVATED', label: 'Inativação de documento' },
    { value: 'DOCUMENT_UPLOAD', label: 'Envio de arquivo' },
    { value: 'DOCUMENT_DOWNLOAD', label: 'Download de documento' },
    { value: 'AI_QUERY', label: 'Consulta à IA' },
    { value: 'SETTINGS_UPDATE', label: 'Alteração de configurações' },
  ]
}
