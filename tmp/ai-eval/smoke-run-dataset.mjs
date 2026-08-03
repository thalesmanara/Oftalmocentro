import { writeFileSync, readFileSync } from 'fs'

const BASE = process.env.N8N_BASE || 'https://n8n.oftalmocentrouberaba.cloud'
const EMAIL = process.env.TEST_EMAIL || 'compras@oftalmocentrouberaba.com.br'
const PASSWORD = process.env.TEST_PASSWORD || '12345678'

async function req(path, { method = 'GET', token, body, timeoutMs = 300000 } = {}) {
  const headers = { Accept: 'application/json' }
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    const text = await res.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { status: res.status, json, text }
  } finally {
    clearTimeout(timer)
  }
}

const output = { startedAt: new Date().toISOString() }

const login = await req('/webhook/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
})
const token = login.json?.data?.accessToken || login.json?.data?.token || ''
console.log(`Login status=${login.status} hasToken=${!!token}`)
output.login = { status: login.status, hasToken: !!token }

if (!token) {
  writeFileSync(new URL('./smoke-run-dataset-results.json', import.meta.url), JSON.stringify(output, null, 2))
  process.exit(1)
}

const t0 = Date.now()
const run = await req('/webhook/system/ai-eval/run-dataset', {
  method: 'POST',
  token,
  body: { groupName: 'Planilhas', includeMissingDocs: false },
  timeoutMs: 300000,
})
const durationMs = Date.now() - t0
console.log(`run-dataset status=${run.status} durationMs=${durationMs}`)
output.runDataset = { status: run.status, durationMs, raw: run.json }

writeFileSync(new URL('./smoke-run-dataset-results.json', import.meta.url), JSON.stringify(output, null, 2))

// Merge into main smoke-results.json if present
try {
  const mainPath = new URL('./smoke-results.json', import.meta.url)
  const main = JSON.parse(readFileSync(mainPath))
  main.runDataset = output.runDataset
  writeFileSync(mainPath, JSON.stringify(main, null, 2))
} catch (e) {
  console.log('Could not merge into smoke-results.json:', e.message)
}

process.exit(run.status === 200 ? 0 : 1)
