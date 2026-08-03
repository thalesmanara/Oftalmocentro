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
  return { status: res.status, json, text }
}

const output = { startedAt: new Date().toISOString() }

const login = await req('/webhook/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
})
const token = login.json?.data?.accessToken || login.json?.data?.token || ''
ok('Login', !!token, `status=${login.status} email=${EMAIL}`)
output.login = { status: login.status, hasToken: !!token }

const cases = await req('/webhook/system/ai-eval/cases?pageSize=5', { token })
const casesItems = cases.json?.data?.items || cases.json?.items || []
ok(
  '1. GET ai-eval/cases pageSize=5 → items.length > 0',
  cases.status === 200 && Array.isArray(casesItems) && casesItems.length > 0,
  `status=${cases.status} items=${casesItems.length}`,
)
output.cases = { status: cases.status, itemsLength: casesItems.length, sample: casesItems[0] || null, raw: cases.json }

const runCase = await req('/webhook/system/ai-eval/run-case', {
  method: 'POST',
  token,
  body: { caseCode: 'TC-001' },
})
const runCaseData = runCase.json?.data || {}
ok(
  '2. POST ai-eval/run-case TC-001 → run + result',
  runCase.status === 200 && runCase.json?.success === true && !!(runCaseData.run || runCaseData.result || runCaseData.runId),
  `status=${runCase.status} success=${runCase.json?.success}`,
)
output.runCase = { status: runCase.status, raw: runCase.json }

const health = await req('/webhook/system/health', { token })
const aiEval = health.json?.data?.components?.aiEval
ok(
  '3. GET system/health → components.aiEval with casesCount ~100',
  (health.status === 200 || health.status === 503) && !!aiEval && Number(aiEval.casesCount) > 0,
  `status=${health.status} aiEval=${JSON.stringify(aiEval)}`,
)
output.health = { status: health.status, aiEval, raw: health.json }

output.results = results
output.finishedAt = new Date().toISOString()

writeFileSync(
  new URL('./smoke-results.json', import.meta.url),
  JSON.stringify(output, null, 2),
)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
