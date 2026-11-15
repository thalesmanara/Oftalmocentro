#!/usr/bin/env node
import pg from 'pg'

const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const id = 'dc78b735-671c-4037-82ab-7c7f5dc0bcad'

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json()
const token = login.data.token

const { rows } = await c.query('SELECT current_version_id FROM documents WHERE id=$1', [id])
const versionId = rows[0].current_version_id

await c.query(
  `UPDATE document_versions
   SET status='PROCESSING', processing_status='processing',
       validation_status='VALID', validation_error_code=NULL
   WHERE id=$1`,
  [versionId],
)
await c.query(`UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`, [id])

console.log('calling process...')
const ctrl = new AbortController()
const t = setTimeout(() => ctrl.abort(), 600000)
const r = await fetch(`${BASE}/webhook/documents/process`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({ documentId: id }),
  signal: ctrl.signal,
})
clearTimeout(t)
const text = await r.text()
console.log('http', r.status, text.slice(0, 800))

for (let i = 0; i < 36; i++) {
  const st = await c.query(
    `SELECT d.processing_status, v.status AS v_status, v.ocr_status, v.embedding_status,
            v.qdrant_sync_status, length(coalesce(v.extracted_text,'')) AS text_len,
            (SELECT count(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks,
            (SELECT count(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') AS valid_chunks
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  )
  console.log('poll', i, st.rows[0])
  const s = st.rows[0]
  if (s.chunks > 0 && s.valid_chunks === s.chunks && s.embedding_status === 'VALID') break
  if (['failed', 'error', 'processed'].includes(String(s.processing_status)) && i > 1) break
  await new Promise((x) => setTimeout(x, 5000))
}

await c.end()
