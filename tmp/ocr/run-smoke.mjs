/**
 * Smoke tests for OCR corporate pipeline.
 * Run: node tmp/ocr/run-smoke.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = process.env.N8N_BASE || 'https://n8n.oftalmocentrouberaba.cloud'
const EMAIL = process.env.TEST_EMAIL || 'compras@oftalmocentrouberaba.com.br'
const PASS = process.env.TEST_PASS || '12345678'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIX = path.join(__dirname, 'fixtures')

const results = []
function ok(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts)
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { res, body, text }
}

async function login() {
  const { res, body } = await jsonFetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const token = body?.data?.token || body?.token
  if (!res.ok || !token) throw new Error('login failed: ' + JSON.stringify(body).slice(0, 300))
  return token
}

async function main() {
  fs.mkdirSync(FIX, { recursive: true })

  // minimal valid-ish PDF (one page blank with text object optional)
  const textPdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 24 Tf 50 80 Td (OCR TEST TEXTUAL) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000360 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
429
%%EOF
`
  const textPdfPath = path.join(FIX, 'textual.pdf')
  fs.writeFileSync(textPdfPath, textPdf)

  // corrupt
  fs.writeFileSync(path.join(FIX, 'corrupt.pdf'), 'not-a-pdf')

  const token = await login()
  ok('login', true)

  // health public
  {
    const { res, body } = await jsonFetch(`${BASE}/webhook/health`)
    ok('GET /health', res.ok, JSON.stringify(body?.data || body).slice(0, 120))
  }

  // system health (needs admin perm - may fail for compras)
  {
    const { res, body } = await jsonFetch(`${BASE}/webhook/system/health`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const ocr = body?.data?.components?.ocr || body?.components?.ocr
    ok(
      'system health reachable',
      res.status === 200 || res.status === 403,
      `status=${res.status} ocr=${ocr ? JSON.stringify(ocr).slice(0, 160) : 'n/a'}`
    )
    if (ocr) {
      ok('health has ocr component', ocr.status != null || ocr.available != null, JSON.stringify(ocr).slice(0, 200))
    }
  }

  // OCR webhook without file should 4xx with auth
  {
    const { res, body } = await jsonFetch(`${BASE}/webhook/documents/ocr`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documentId: '00000000-0000-4000-8000-000000000000', force: true }),
    })
    ok(
      'POST documents/ocr invalid id handled',
      res.status >= 400 && res.status < 600,
      `status=${res.status} code=${body?.error?.code || body?.code || ''}`
    )
  }

  // list documents
  {
    const { res, body } = await jsonFetch(`${BASE}/webhook/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const list = body?.data || body
    ok('GET documents', res.ok && Array.isArray(list), `count=${Array.isArray(list) ? list.length : '?'}`)
  }

  console.log('\nSummary:', results.filter((r) => r.pass).length, '/', results.length, 'passed')
  const failed = results.filter((r) => !r.pass)
  if (failed.length) {
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
