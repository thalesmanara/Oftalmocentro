#!/usr/bin/env node
import pg from 'pg'
import { writeFileSync } from 'fs'

const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const EMB_PATHS = [
  '/webhook/system/embeddings/reprocess',
  '/webhook/A3ps15dPHWoN2LZf/webhook/system/embeddings/reprocess',
]
const QDRANT_PATHS = [
  '/webhook/system/qdrant/reindex',
  '/webhook/zBMDF4cbf7kMk7u2/webhook/system/qdrant/reindex',
]

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

async function login() {
  for (let i = 0; i < 10; i++) {
    try {
      const r = await fetch(`${BASE}/webhook/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'compras@oftalmocentrouberaba.com.br',
          password: '12345678',
        }),
      })
      const j = await r.json()
      if (j?.data?.token) return j.data.token
    } catch {}
    await new Promise((x) => setTimeout(x, 3000))
  }
  throw new Error('login failed')
}

async function api(path, token, body, timeoutMs = 600000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await r.text()
    let j = null
    try {
      j = text ? JSON.parse(text) : null
    } catch {
      j = { raw: text.slice(0, 400) }
    }
    return { status: r.status, j, path }
  } finally {
    clearTimeout(t)
  }
}

async function firstWorking(paths, token, body) {
  let last = null
  for (const p of paths) {
    const r = await api(p, token, body)
    console.log(p, r.status, r.j?.success ?? r.j?.message ?? r.j?.code)
    last = r
    if (r.status >= 200 && r.status < 300 && r.j?.success !== false) return r
    if (r.status !== 404) return r
  }
  return last
}

const token = await login()
console.log('logged in')

// Ensure pending chunks
await c.query(`
  UPDATE document_chunks c
  SET embedding_status='PENDING', embedding_next_retry_at=NULL, embedding_last_error=NULL
  WHERE c.embedding_status <> 'VALID'
    AND c.document_id IN (
      SELECT d.id FROM documents d
      WHERE d.deleted_at IS NULL
        AND d.processed_at > NOW() - INTERVAL '1 day'
    )
`)

let embOk = null
for (let round = 0; round < 40; round++) {
  const { rows } = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE embedding_status='PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE embedding_status='VALID')::int AS valid,
      COUNT(*) FILTER (WHERE embedding_status='FAILED')::int AS failed
    FROM document_chunks
  `)
  console.log('round', round, rows[0])
  if (rows[0].pending === 0) break

  embOk = await firstWorking(EMB_PATHS, token, { force: true, limit: 500 })
  console.log('emb call', embOk?.status, JSON.stringify(embOk?.j).slice(0, 250))
  await new Promise((x) => setTimeout(x, 8000))
}

// Qdrant for recently processed docs
const { rows: docs } = await c.query(`
  SELECT d.id, d.title
  FROM documents d
  JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND d.processing_status='processed'
    AND EXISTS (
      SELECT 1 FROM document_chunks c
      WHERE c.document_id=d.id AND c.embedding_status='VALID'
        AND COALESCE(c.embedding_sync_status,'') <> 'SYNCED'
    )
  ORDER BY d.updated_at DESC
`)
console.log('docs needing qdrant', docs.length)

const qReport = []
for (const doc of docs) {
  const r = await firstWorking(QDRANT_PATHS, token, { scope: 'document', documentId: doc.id })
  qReport.push({ id: doc.id, title: doc.title, status: r?.status, body: r?.j })
  console.log('qdrant', doc.title.slice(0, 50), r?.status, r?.j?.success ?? r?.j?.message)
}

await c.query(`
  UPDATE document_versions v
  SET embedding_status = CASE
        WHEN EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING') THEN 'PENDING'
        WHEN EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') THEN 'VALID'
        ELSE embedding_status END,
      embedding_valid_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'),
      embedding_pending_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING'),
      embedding_failed_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='FAILED'),
      qdrant_synced_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'),
      qdrant_sync_status=CASE
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)=0 THEN qdrant_sync_status
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)
           = (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED')
          THEN 'SYNCED'
        ELSE COALESCE(qdrant_sync_status,'PENDING')
      END
  WHERE v.id IN (SELECT current_version_id FROM documents WHERE deleted_at IS NULL)
`)

const summary = await c.query(`
  SELECT
    COUNT(*)::int docs,
    COUNT(*) FILTER (WHERE d.processing_status='processed')::int processed,
    COUNT(*) FILTER (WHERE d.processing_status='processing')::int processing,
    COUNT(*) FILTER (WHERE length(coalesce(v.extracted_text,''))>100)::int with_text,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id))::int chunks,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'))::int valid,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'))::int synced
  FROM documents d
  JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
`)

const remaining = await c.query(`
  SELECT d.id, d.title, d.processing_status,
         length(coalesce(v.extracted_text,'')) text_len,
         v.embedding_status, v.qdrant_sync_status,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING') pending_chunks
  FROM documents d JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND (
      d.processing_status IN ('pending','processing','failed','error')
      OR EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING')
      OR COALESCE(v.qdrant_sync_status,'') <> 'SYNCED'
    )
  ORDER BY d.processing_status, d.title
  LIMIT 100
`)

const out = {
  at: new Date().toISOString(),
  summary: summary.rows[0],
  remaining: remaining.rows,
  qReportCount: qReport.length,
}
writeFileSync(new URL('./finish-embeddings-qdrant-report.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('SUMMARY', summary.rows[0])
console.log('REMAINING', remaining.rows.length)
await c.end()
