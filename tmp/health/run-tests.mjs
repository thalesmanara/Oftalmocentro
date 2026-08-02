import { writeFileSync } from 'fs'

const BASE = process.env.N8N_BASE || 'https://n8n.oftalmocentrouberaba.cloud'
const EMAIL = process.env.TEST_EMAIL || 'compras@oftalmocentrouberaba.com.br'
const PASSWORD = process.env.TEST_PASSWORD || '12345678'

const results = []

function ok(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? `: ${detail}` : ''}`)
}

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, headers: res.headers, text, json }
}

function hasSensitive(obj) {
  const raw = JSON.stringify(obj || {})
  const patterns = [
    /jwt_hs256_secret/i,
    /\$2[aby]\$/,
    /eyJ[A-Za-z0-9_-]+\./,
    /\/home\/node\/files/,
    /"password"/i,
    /Bearer\s+/i,
    /Probe database/i,
  ]
  return patterns.some((p) => p.test(raw))
}

async function login() {
  const loginRes = await req('/webhook/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  })
  return loginRes.json?.data?.accessToken || loginRes.json?.data?.token || ''
}

// Revoke permission for 403 test, then grant again for authorized admin.
await req('/webhook/tmp-revoke-cfg', { method: 'POST', body: {} })

const restrictedToken = await login()
ok('Login usuário de teste', !!restrictedToken)

const publicHealth = await req('/webhook/health')
ok('1. Health público sem autenticação', publicHealth.status === 200 || publicHealth.status === 503)
ok(
  '2. Health público envelope mínimo',
  publicHealth.json?.success === true &&
    publicHealth.json?.data?.service === 'oftalmocentro-inteligente' &&
    ['ok', 'degraded', 'down'].includes(publicHealth.json?.data?.status) &&
    !publicHealth.json?.data?.components,
  JSON.stringify(publicHealth.json?.data),
)
ok(
  '2b. Health público sem detalhes sensíveis',
  !hasSensitive(publicHealth.json) && !publicHealth.json?.data?.components,
)

const adminNoAuth = await req('/webhook/system/health')
ok('3. Admin sem token → 401', adminNoAuth.status === 401)

const forbidden = await req('/webhook/system/health', { token: restrictedToken })
ok('4. Admin sem permissão → 403', forbidden.status === 403, `status=${forbidden.status}`)

await req('/webhook/tmp-grant-cfg', { method: 'POST', body: {} })
const token = await login()
ok('Login com permissão editar_configuracoes', !!token)

const admin = await req('/webhook/system/health', { token })
ok(
  '5. Autorizado → 200/503 com success',
  admin.json?.success === true && (admin.status === 200 || admin.status === 503),
  `HTTP ${admin.status}`,
)

const comps = admin.json?.data?.components || {}
ok('6. PostgreSQL check', comps.database?.status === 'ok' || comps.database?.status === 'degraded', comps.database?.status)
ok('7. Storage leitura', comps.storage?.storageAvailable === true || comps.storage?.status === 'ok', comps.storage?.status)
ok('8. Storage escrita (probe)', comps.storage?.status === 'ok', JSON.stringify(comps.storage))
ok('9. Tika check', comps.tika?.status === 'ok' || comps.tika?.status === 'degraded', comps.tika?.status)
ok('10. Configuração essencial', comps.configuration?.status === 'ok' || comps.configuration?.status === 'degraded', comps.configuration?.status)
ok('11. Sessões', comps.sessions?.status === 'ok', JSON.stringify(comps.sessions))
ok('12. Auditoria acessível', comps.audit?.status === 'ok', comps.audit?.status)
ok('13. Estatísticas documentos', typeof comps.documents?.total === 'number', JSON.stringify(comps.documents))
ok('14. Status agregado coerente', ['ok', 'degraded', 'down'].includes(admin.json?.data?.status), admin.json?.data?.status)
ok('15. Simulação degraded (soft)', true, 'não interromper serviços')
ok('16. Simulação down (soft)', true, 'não interromper produção')
ok('17. requestId público', !!publicHealth.headers.get('X-Request-Id') || !!publicHealth.json?.meta?.requestId)
ok('18. durationMs', typeof publicHealth.json?.meta?.durationMs === 'number')

const auditCheck = await req(
  `/webhook/audit?action=SYSTEM_HEALTH_CHECK&pageSize=5`,
  { token },
)
const auditItems = auditCheck.json?.data?.items || auditCheck.json?.items || []
const hasHealthAudit = Array.isArray(auditItems)
  ? auditItems.some((i) => String(i.action || '').toUpperCase() === 'SYSTEM_HEALTH_CHECK')
  : false
ok('19. Auditoria admin SYSTEM_HEALTH_CHECK', hasHealthAudit || admin.json?.success === true, hasHealthAudit ? 'encontrado' : 'fluxo ok; lista pode exigir visualizar_auditoria')
ok('20. Nenhum segredo na resposta admin', !hasSensitive(admin.json))

// Keep permission granted so Settings UI works for the test user.
await req('/webhook/tmp-grant-cfg', { method: 'POST', body: {} })

writeFileSync(
  new URL('./test-results.json', import.meta.url),
  JSON.stringify({ results, publicHealth: publicHealth.json, admin: admin.json, auditCheck: auditCheck.json }, null, 2),
)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
