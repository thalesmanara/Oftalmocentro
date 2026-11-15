#!/usr/bin/env node
/**
 * Processa docs travados fora do webhook quebrado:
 * Tika (via SSH/docker n8n) → texto/chunks no PG → embeddings reprocess → qdrant reindex.
 */
import pg from 'pg'
import { writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { execFileSync } from 'child_process'

const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const N8N_CONTAINER = 'n8n-vrv8r1yp224hzobdqqcenajo'

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
  const script = `const fs=require('fs');const http=require('http');
const full=process.argv[1];
const buf=fs.readFileSync(full);
const req=http.request({hostname:'tika',port:9998,path:'/tika',method:'PUT',headers:{Accept:'text/plain','Content-Type':'application/octet-stream','Content-Length':buf.length},timeout:180000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(Buffer.concat(c)));});
req.on('error',e=>{console.error(String(e));process.exit(1);});
req.write(buf);req.end();`
  const b64 = Buffer.from(script).toString('base64')
  const remote = `docker exec -i ${N8N_CONTAINER} sh -c 'echo ${b64} | base64 -d > /tmp/tika-one.js && node /tmp/tika-one.js "$1"' _ ${JSON.stringify(filePath)}`
  return execFileSync('ssh', ['oftalmocentro', remote], {
    maxBuffer: 30 * 1024 * 1024,
    timeout: 240000,
  }).toString('utf8')
}

async function login(retries = 8) {
  let last = null
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}/webhook/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'compras@oftalmocentrouberaba.com.br',
          password: '12345678',
        }),
      })
      const text = await r.text()
      let j = null
      try {
        j = text ? JSON.parse(text) : null
      } catch {
        last = text.slice(0, 200)
        await new Promise((x) => setTimeout(x, 3000))
        continue
      }
      const token = j?.data?.token
      if (token) return token
      last = JSON.stringify(j).slice(0, 200)
    } catch (e) {
      last = String(e?.message || e)
    }
    await new Promise((x) => setTimeout(x, 3000))
  }
  throw new Error('login failed: ' + last)
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
    return { status: r.status, j }
  } finally {
    clearTimeout(t)
  }
}

const { rows: stuck } = await c.query(`
  SELECT d.id, d.title, v.id AS version_id, v.file_path,
         length(coalesce(v.extracted_text,'')) AS text_len,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks
  FROM documents d
  JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND d.processing_status IN ('pending','processing','failed','error')
    AND COALESCE(NULLIF(v.file_path,''), NULLIF(v.file_name,'')) IS NOT NULL
  ORDER BY d.created_at
`)

console.log('stuck', stuck.length)
const token = await login()
const report = []

for (let i = 0; i < stuck.length; i++) {
  const doc = stuck[i]
  const item = { id: doc.id, title: doc.title }
  console.log(`\n[${i + 1}/${stuck.length}] ${doc.title}`)
  try {
    let raw = null
    if (doc.text_len > 200) {
      const { rows } = await c.query(`SELECT extracted_text FROM document_versions WHERE id=$1`, [doc.version_id])
      raw = rows[0].extracted_text
      console.log('  reuse text', doc.text_len)
    } else {
      console.log('  tika...', doc.file_path)
      raw = tikaExtract(doc.file_path)
    }

    const { text, chunks } = makeChunks(raw, doc.id, doc.version_id)
    item.textLen = text.length
    item.chunks = chunks.length
    console.log('  text', text.length, 'chunks', chunks.length)

    if (text.length < 40 || chunks.length === 0) {
      item.error = 'EMPTY_TEXT'
      await c.query(
        `UPDATE document_versions SET status='FAILED', processing_status='failed', ocr_status='FAILED', validation_status='VALID' WHERE id=$1`,
        [doc.version_id],
      )
      await c.query(`UPDATE documents SET processing_status='failed', updated_at=NOW() WHERE id=$1`, [doc.id])
      report.push(item)
      continue
    }

    await c.query(
      `UPDATE document_versions
       SET extracted_text=$1, extraction_method='tika', ocr_status='NOT_REQUIRED',
           status='READY', processing_status='processed', validation_status='VALID',
           validation_error_code=NULL, embedding_status='PENDING', qdrant_sync_status='PENDING'
       WHERE id=$2`,
      [text, doc.version_id],
    )
    await c.query(
      `UPDATE documents
       SET extracted_text=$1, file_path=COALESCE(file_path,$2), processing_status='processed',
           processed_at=COALESCE(processed_at,NOW()), updated_at=NOW()
       WHERE id=$3`,
      [text, doc.file_path, doc.id],
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
    item.okExtract = true
  } catch (err) {
    item.error = String(err?.message || err)
    console.error('  ERROR', item.error)
  }
  report.push(item)
  writeFileSync(
    new URL('./process-all-direct-report.json', import.meta.url),
    JSON.stringify({ at: new Date().toISOString(), done: report.length, total: stuck.length, report }, null, 2),
  )
}

console.log('\n=== embeddings reprocess ===')
const emb = await api('/webhook/system/embeddings/reprocess', token, { force: true, limit: 5000 }, 600000)
console.log('emb', emb.status, emb.j?.success, emb.j?.data || emb.j?.error || emb.j?.message)

// Wait/poll pending embeddings
for (let i = 0; i < 60; i++) {
  const { rows } = await c.query(`
    SELECT
      COUNT(*) FILTER (WHERE c.embedding_status='PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE c.embedding_status='VALID')::int AS valid,
      COUNT(*) FILTER (WHERE c.embedding_status='FAILED')::int AS failed
    FROM documents d
    JOIN document_chunks c ON c.document_id=d.id
    WHERE d.deleted_at IS NULL AND d.id = ANY($1::uuid[])
  `, [stuck.map((d) => d.id)])
  console.log('emb poll', i, rows[0])
  if (rows[0].pending === 0) break
  // trigger again periodically
  if (i > 0 && i % 5 === 0) {
    await api('/webhook/system/embeddings/reprocess', token, { force: false, limit: 2000 }, 300000)
  }
  await new Promise((r) => setTimeout(r, 10000))
}

console.log('\n=== qdrant reindex per doc ===')
for (const doc of stuck) {
  try {
    const r = await api(
      '/webhook/system/qdrant/reindex',
      token,
      { scope: 'document', documentId: doc.id },
      180000,
    )
    console.log('qdrant', doc.title.slice(0, 40), r.status, r.j?.success ?? r.j?.error?.code ?? r.j?.message)
  } catch (e) {
    console.log('qdrant err', doc.id, e.message)
  }
}

// Finalize version stats
await c.query(`
  UPDATE document_versions v
  SET embedding_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING'
        ) THEN 'PENDING'
        WHEN EXISTS (
          SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'
        ) THEN 'VALID'
        ELSE embedding_status
      END,
      embedding_valid_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'),
      embedding_pending_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='PENDING'),
      embedding_failed_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='FAILED'),
      qdrant_sync_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id AND COALESCE(c.embedding_sync_status,'')='SYNCED'
        ) THEN 'SYNCED'
        ELSE qdrant_sync_status
      END,
      qdrant_synced_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'),
      status='READY',
      processing_status='processed'
  WHERE v.id IN (
    SELECT d.current_version_id FROM documents d
    WHERE d.deleted_at IS NULL AND d.id = ANY($1::uuid[])
  )
`, [stuck.map((d) => d.id)])

await c.query(`
  UPDATE documents
  SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW()
  WHERE deleted_at IS NULL AND id = ANY($1::uuid[])
    AND EXISTS (
      SELECT 1 FROM document_chunks c WHERE c.document_id=documents.id
    )
`, [stuck.map((d) => d.id)])

const counts = await c.query(`
  SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC
`)
const remaining = await c.query(`
  SELECT d.id, d.title, d.processing_status,
         length(coalesce(v.extracted_text,'')) text_len,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) chunks,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') valid,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED') synced
  FROM documents d JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL AND d.processing_status IN ('pending','processing','failed','error')
  ORDER BY 3,2
`)
const summary = await c.query(`
  SELECT
    COUNT(*)::int AS docs,
    COUNT(*) FILTER (WHERE length(coalesce(v.extracted_text,''))>100)::int AS with_text,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id))::int AS chunks,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'))::int AS valid,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'))::int AS synced
  FROM documents d JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL AND d.id = ANY($1::uuid[])
`, [stuck.map((d) => d.id)])

const out = {
  at: new Date().toISOString(),
  emb,
  counts: counts.rows,
  remaining: remaining.rows,
  summary: summary.rows[0],
  report,
}
writeFileSync(new URL('./process-all-direct-report.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('\nCOUNTS', counts.rows)
console.log('SUMMARY', summary.rows[0])
console.log('REMAINING', remaining.rows.length)
await c.end()
