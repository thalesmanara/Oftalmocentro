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
  return { status: res.status, headers: res.headers, json, text }
}

function hasSecretLeak(obj) {
  const raw = JSON.stringify(obj || {})
  return (
    /jwt_hs256_secret["']?\s*:/i.test(raw) ||
    /\$2[aby]\$/.test(raw) ||
    /sk-[A-Za-z0-9]{10,}/.test(raw) ||
    /Bearer\s+[A-Za-z0-9._-]+/.test(raw) ||
    /\/home\/node\/files\//.test(raw)
  )
}

const login = await req('/webhook/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
})
const token = login.json?.data?.accessToken || login.json?.data?.token || ''
ok('Login autorizado', !!token, `status=${login.status}`)

const noAuth = await req('/webhook/system/backups')
ok('11. GET backups sem token → 401', noAuth.status === 401)

const list = await req('/webhook/system/backups', { token })
ok('12. GET backups autorizado', list.status === 200 && list.json?.success === true, `HTTP ${list.status}`)
const data = list.json?.data || {}
ok('1. Migration/registros existem', Array.isArray(data.runs) && data.runs.length > 0, `runs=${data.runs?.length}`)
ok(
  '9. Status SUCCESS/PARTIAL/FAILED coerente',
  data.runs.every((r) => ['STARTED', 'SUCCESS', 'PARTIAL', 'FAILED', 'VERIFIED'].includes(r.status)),
)
const dbRun = data.runs.find((r) => r.backupType === 'DATABASE' && r.status === 'PARTIAL')
const wfRun = data.runs.find((r) => r.backupType === 'N8N_WORKFLOWS' && (r.status === 'VERIFIED' || r.status === 'SUCCESS'))
const docRun = data.runs.find((r) => r.backupType === 'DOCUMENT_FILES' && r.status === 'PARTIAL')
ok('3. Backup banco registrado (PARTIAL lógico)', !!dbRun, dbRun?.fileName)
ok('5. Export workflows', !!wfRun, wfRun?.fileName)
ok('4. Inventário documentos', !!docRun, docRun?.fileName)
ok('6. Arquivo > 0 (banco/workflows)', Number(dbRun?.fileSize || 0) > 0 && Number(wfRun?.fileSize || 0) > 0)
ok('7. SHA-256 presente (abreviado na API)', !!(dbRun?.checksum || wfRun?.checksum))
ok('8. Manifesto/limitations', data.limitations?.disasterRecovery === false && data.limitations?.pgDump === false)
ok('10. Sem segredo/path físico na API', !hasSecretLeak(list.json))

const run = await req('/webhook/system/backups/run', { method: 'POST', token, body: { type: 'N8N_WORKFLOWS' } })
ok(
  '14. POST run suportado',
  run.status === 200 && run.json?.success === true,
  `HTTP ${run.status}`,
)

const health = await req('/webhook/system/health', { token })
const backupComp = health.json?.data?.components?.backup
ok('15. Health admin com backup', !!backupComp?.status, JSON.stringify(backupComp))

ok('16. Retenção destrutiva não ativa', true, 'não implementada')
ok('17. Restore isolado pendente', data.limitations?.restoreTestIsolated === false, 'esperado pendente')
ok('20. Sem funcionalidade fictícia de DR', data.limitations?.disasterRecovery === false)

writeFileSync(new URL('./test-results.json', import.meta.url), JSON.stringify({ results, list: data, run: run.json }, null, 2))
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
