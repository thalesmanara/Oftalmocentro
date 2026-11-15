#!/usr/bin/env node
/**
 * Reextrai docs cujo texto ficou com lixo do script tika-one.js
 * e regenera chunks. Depois dispara embeddings/qdrant pelos paths UUID.
 */
import pg from 'pg'
import { writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { execFileSync } from 'child_process'

const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const N8N_CONTAINER = 'n8n-vrv8r1yp224hzobdqqcenajo'
const EMB = '/webhook/A3ps15dPHWoN2LZf/webhook/system/embeddings/reprocess'
const QDRANT = '/webhook/zBMDF4cbf7kMk7u2/webhook/system/qdrant/reindex'

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

function normalizeDocumentText(raw) {
  let t = String(raw ?? '')
  t = t.normalize('NFC')
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
  t = t.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n]/gu, '')
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n')
  return t
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
    .join('\n')
    .trim()
}

function makeChunks(rawText, documentId, versionId) {
  const text = normalizeDocumentText(rawText)
  const soft = text.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()
  const chunkSize = 1100
  const overlap = 160
  const chunks = []
  let i = 0
  while (i < soft.length) {
    let end = Math.min(i + chunkSize, soft.length)
    if (end < soft.length) {
      const window = soft.slice(i, end)
      const idx = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' '))
      if (idx >= Math.floor(chunkSize * 0.55)) end = i + idx + 1
    }
    const content = soft.slice(i, end).trim()
    if (content.length >= 40) chunks.push({ documentId, versionId, chunkIndex: chunks.length, content })
    if (end >= soft.length) break
    i = Math.max(end - overlap, i + 1)
  }
  return { text, chunks }
}

function tikaExtract(filePath) {
  const js = `
const fs = require('fs');
const http = require('http');
const f = ${JSON.stringify(filePath)};
const buf = fs.readFileSync(f);
const req = http.request({
  hostname: 'tika',
  port: 9998,
  path: '/tika',
  method: 'PUT',
  headers: {
    Accept: 'text/plain',
    'Content-Type': 'application/octet-stream',
    'Content-Length': buf.length,
  },
  timeout: 180000,
}, (res) => {
  const c = [];
  res.on('data', (d) => c.push(d));
  res.on('end', () => process.stdout.write(Buffer.concat(c)));
});
req.on('error', (e) => { console.error(String(e)); process.exit(1); });
req.write(buf);
req.end();
`
  return execFileSync(
    'ssh',
    ['oftalmocentro', `docker exec -i ${N8N_CONTAINER} node`],
    { input: js, maxBuffer: 30 * 1024 * 1024, timeout: 240000 },
  ).toString('utf8')
}

async function login() {
  const r = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed')
  return j.data.token
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
      j = { raw: text.slice(0, 300) }
    }
    return { status: r.status, j }
  } finally {
    clearTimeout(t)
  }
}

const { rows: bad } = await c.query(`
  SELECT d.id, d.title, v.id AS version_id, v.file_path,
         length(coalesce(v.extracted_text,'')) AS text_len
  FROM documents d
  JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND (
      coalesce(v.extracted_text,'') ILIKE '%fsrequire%'
      OR coalesce(v.extracted_text,'') ILIKE '%const fs=%'
      OR coalesce(v.extracted_text,'') ILIKE '%readFileSync%'
      OR coalesce(d.extracted_text,'') ILIKE '%fsrequire%'
    )
  ORDER BY d.created_at
`)

console.log('bad docs', bad.length)
if (!bad.length) {
  console.log('nothing to fix')
  await c.end()
  process.exit(0)
}

// smoke one extraction
{
  const sample = tikaExtract(bad[0].file_path)
  console.log('smoke len', sample.length, 'preview', sample.slice(0, 120).replace(/\n/g, ' '))
  if (sample.includes('fsrequire') || sample.length < 80) {
    throw new Error('tika still broken')
  }
}

const report = []
for (let i = 0; i < bad.length; i++) {
  const doc = bad[i]
  const item = { id: doc.id, title: doc.title }
  console.log(`\n[${i + 1}/${bad.length}] ${doc.title}`)
  try {
    const raw = tikaExtract(doc.file_path)
    const { text, chunks } = makeChunks(raw, doc.id, doc.version_id)
    item.textLen = text.length
    item.chunks = chunks.length
    console.log('  text', text.length, 'chunks', chunks.length, 'preview', text.slice(0, 80).replace(/\n/g, ' '))

    if (text.length < 40 || chunks.length === 0 || text.includes('fsrequire')) {
      item.error = 'BAD_EXTRACT'
      report.push(item)
      continue
    }

    await c.query(
      `UPDATE document_versions
       SET extracted_text=$1, extraction_method='tika', ocr_status='NOT_REQUIRED',
           status='READY', processing_status='processed', validation_status='VALID',
           embedding_status='PENDING', qdrant_sync_status='PENDING'
       WHERE id=$2`,
      [text, doc.version_id],
    )
    await c.query(
      `UPDATE documents
       SET extracted_text=$1, processing_status='processed',
           processed_at=COALESCE(processed_at,NOW()), updated_at=NOW()
       WHERE id=$2`,
      [text, doc.id],
    )
    await c.query(`DELETE FROM document_chunks WHERE document_version_id=$1 OR document_id=$2`, [
      doc.version_id,
      doc.id,
    ])
    for (const ch of chunks) {
      const hash = createHash('sha256').update(ch.content, 'utf8').digest('hex')
      await c.query(
        `INSERT INTO document_chunks
           (document_id, document_version_id, chunk_order, chunk_index, chunk_text, content_hash, embedding_status)
         VALUES ($1,$2,$3,$3,$4,$5,'PENDING')`,
        [ch.documentId, ch.versionId, ch.chunkIndex, ch.content, hash],
      )
    }
    item.ok = true
  } catch (e) {
    item.error = String(e?.message || e)
    console.error('  ERROR', item.error)
  }
  report.push(item)
  writeFileSync(
    new URL('./reextract-bad-report.json', import.meta.url),
    JSON.stringify({ at: new Date().toISOString(), done: report.length, total: bad.length, report }, null, 2),
  )
}

const token = await login()
console.log('\n=== embeddings ===')
for (let round = 0; round < 50; round++) {
  const { rows } = await c.query(`
    SELECT COUNT(*) FILTER (WHERE embedding_status='PENDING')::int pending,
           COUNT(*) FILTER (WHERE embedding_status='VALID')::int valid
    FROM document_chunks
    WHERE document_id = ANY($1::uuid[])
  `, [bad.map((d) => d.id)])
  console.log('emb', round, rows[0])
  if (rows[0].pending === 0) break
  const emb = await api(EMB, token, { force: true, limit: 500 })
  console.log('emb call', emb.status, JSON.stringify(emb.j).slice(0, 200))
  await new Promise((r) => setTimeout(r, 5000))
}

console.log('\n=== qdrant ===')
for (const doc of bad) {
  const r = await api(QDRANT, token, { scope: 'document', documentId: doc.id }, 180000)
  console.log('qdrant', doc.title.slice(0, 40), r.status, r.j?.success ?? r.j?.message ?? r.j?.code)
}

await c.query(`
  UPDATE document_versions v
  SET embedding_valid_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'),
      embedding_pending_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING'),
      embedding_status=CASE
        WHEN EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING') THEN 'PENDING'
        WHEN EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') THEN 'VALID'
        ELSE embedding_status END,
      qdrant_synced_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'),
      qdrant_sync_status=CASE
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id) > 0
         AND (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)
           = (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED')
        THEN 'SYNCED' ELSE 'PENDING' END
  WHERE v.id = ANY($1::uuid[])
`, [bad.map((d) => d.version_id)])

const summary = await c.query(`
  SELECT
    COUNT(*)::int docs,
    COUNT(*) FILTER (WHERE length(coalesce(v.extracted_text,''))>100 AND coalesce(v.extracted_text,'') NOT ILIKE '%fsrequire%')::int good_text,
    COUNT(*) FILTER (WHERE coalesce(v.extracted_text,'') ILIKE '%fsrequire%')::int still_bad,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id))::int chunks,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'))::int valid,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'))::int synced
  FROM documents d JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.id = ANY($1::uuid[])
`, [bad.map((d) => d.id)])

const counts = await c.query(`
  SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC
`)

const out = {
  at: new Date().toISOString(),
  summary: summary.rows[0],
  counts: counts.rows,
  ok: report.filter((r) => r.ok).length,
  failed: report.filter((r) => !r.ok).length,
  report,
}
writeFileSync(new URL('./reextract-bad-report.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('\nSUMMARY', summary.rows[0])
console.log('COUNTS', counts.rows)
await c.end()
