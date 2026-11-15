#!/usr/bin/env node
/**
 * Reprocessa TODOS os documentos com processing_status em
 * pending/processing/failed/error que ainda tenham arquivo na versão atual.
 */
import pg from 'pg'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'https://n8n.oftalmocentrouberaba.cloud'
const CONCURRENCY = 1
const PROCESS_TIMEOUT_MS = 600_000
const POLL_MS = 5_000
const MAX_POLLS = 90

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

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
  const token = j?.data?.token || j?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(j).slice(0, 300))
  return token
}

async function api(path, token, body, timeoutMs = PROCESS_TIMEOUT_MS) {
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
      j = { raw: text.slice(0, 500) }
    }
    return { status: r.status, j }
  } finally {
    clearTimeout(t)
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function loadStuck() {
  const { rows } = await c.query(`
    SELECT d.id, d.title, d.processing_status, d.is_active,
           v.id AS version_id, v.status AS v_status, v.validation_status,
           v.file_path, v.ocr_status, v.embedding_status, v.qdrant_sync_status
    FROM documents d
    JOIN document_versions v ON v.id = d.current_version_id
    WHERE d.deleted_at IS NULL
      AND d.processing_status IN ('pending','processing','failed','error')
      AND COALESCE(NULLIF(v.file_path,''), NULLIF(v.file_name,''), NULLIF(v.stored_file_name,'')) IS NOT NULL
    ORDER BY d.created_at ASC
  `)
  return rows
}

async function prepare(doc) {
  await c.query(
    `UPDATE document_versions
     SET status='PROCESSING',
         processing_status='processing',
         validation_status='VALID',
         validation_error_code=NULL
     WHERE id=$1`,
    [doc.version_id],
  )
  await c.query(
    `UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`,
    [doc.id],
  )
}

async function pollUntilDone(id, versionId) {
  let last = null
  for (let i = 0; i < MAX_POLLS; i++) {
    const { rows } = await c.query(
      `SELECT d.processing_status,
              v.status AS v_status,
              v.ocr_status,
              v.embedding_status,
              v.qdrant_sync_status,
              length(coalesce(v.extracted_text,'')) AS text_len,
              (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks,
              (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') AS valid_chunks
       FROM documents d
       JOIN document_versions v ON v.id=d.current_version_id
       WHERE d.id=$1`,
      [id],
    )
    last = rows[0]
    const ready =
      last &&
      last.chunks > 0 &&
      last.valid_chunks === last.chunks &&
      (last.qdrant_sync_status === 'SYNCED' || last.embedding_status === 'VALID')

    if (ready) {
      await c.query(
        `UPDATE documents
         SET processing_status='processed',
             processed_at=COALESCE(processed_at,NOW()),
             updated_at=NOW()
         WHERE id=$1 AND processing_status<>'processed'`,
        [id],
      )
      await c.query(
        `UPDATE document_versions
         SET status='READY', processing_status='processed'
         WHERE id=$1 AND status<>'READY'`,
        [versionId],
      )
      last.processing_status = 'processed'
      last.v_status = 'READY'
      return { done: true, poll: i, last }
    }

    if (['failed', 'error'].includes(String(last?.processing_status || '')) && i > 2) {
      return { done: false, poll: i, last }
    }

    // texto+chunks sem embedding ainda: continua
    if (i % 6 === 0) {
      console.log(
        `    poll ${i} status=${last?.processing_status} v=${last?.v_status} emb=${last?.embedding_status} q=${last?.qdrant_sync_status} text=${last?.text_len} chunks=${last?.chunks}/${last?.valid_chunks}`,
      )
    }
    await sleep(POLL_MS)
  }

  // Se já tem texto e chunks, marca processed mesmo com embedding atrasado
  if (last && last.text_len > 100 && last.chunks > 0) {
    await c.query(
      `UPDATE documents
       SET processing_status='processed',
           processed_at=COALESCE(processed_at,NOW()),
           updated_at=NOW()
       WHERE id=$1`,
      [id],
    )
    return { done: true, poll: MAX_POLLS, last, note: 'marked_processed_with_chunks' }
  }

  return { done: false, poll: MAX_POLLS, last, note: 'timeout' }
}

async function processOne(token, doc, index, total) {
  const item = {
    id: doc.id,
    title: doc.title,
    before: {
      processing_status: doc.processing_status,
      validation_status: doc.validation_status,
      ocr_status: doc.ocr_status,
      embedding_status: doc.embedding_status,
      qdrant_sync_status: doc.qdrant_sync_status,
    },
    steps: [],
  }

  console.log(`\n[${index + 1}/${total}] ${doc.title}`)
  console.log(`  id=${doc.id}`)

  try {
    await prepare(doc)
    item.steps.push('prepared')

    const proc = await api('/webhook/documents/process', token, { documentId: doc.id })
    item.process = {
      http: proc.status,
      success: proc.j?.success ?? proc.j?.response?.success,
      message:
        proc.j?.message ||
        proc.j?.data?.message ||
        proc.j?.error?.message ||
        proc.j?.response?.error?.message,
      code: proc.j?.error?.code || proc.j?.code || proc.j?.response?.error?.code,
    }
    item.steps.push(`process http=${proc.status}`)
    console.log('  process', item.process)

    const result = await pollUntilDone(doc.id, doc.version_id)
    item.result = result
    console.log(
      `  final: done=${result.done} status=${result.last?.processing_status} emb=${result.last?.embedding_status} q=${result.last?.qdrant_sync_status} chunks=${result.last?.valid_chunks}/${result.last?.chunks}`,
    )
  } catch (err) {
    item.error = String(err?.message || err)
    console.error('  ERROR', item.error)
  }

  return item
}

const token = await login()
console.log('logged in')

const stuck = await loadStuck()
console.log(`stuck with file: ${stuck.length}`)

const report = []
for (let i = 0; i < stuck.length; i += CONCURRENCY) {
  const batch = stuck.slice(i, i + CONCURRENCY)
  const results = await Promise.all(batch.map((doc, j) => processOne(token, doc, i + j, stuck.length)))
  report.push(...results)

  // checkpoint parcial
  writeFileSync(
    join(__dirname, 'reprocess-all-stuck-report.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        processedSoFar: report.length,
        total: stuck.length,
        report,
      },
      null,
      2,
    ),
  )
}

const counts = await c.query(`
  SELECT processing_status, COUNT(*)::int AS n
  FROM documents
  WHERE deleted_at IS NULL
  GROUP BY 1
  ORDER BY 2 DESC
`)
const remaining = await c.query(`
  SELECT d.id, d.title, d.processing_status, v.embedding_status, v.qdrant_sync_status,
         length(coalesce(v.extracted_text,'')) AS text_len
  FROM documents d
  JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND d.processing_status IN ('pending','processing','failed','error')
  ORDER BY d.processing_status, d.title
`)

const out = {
  at: new Date().toISOString(),
  totalAttempted: stuck.length,
  ok: report.filter((r) => r.result?.done).length,
  failed: report.filter((r) => !r.result?.done).length,
  counts: counts.rows,
  remaining: remaining.rows,
  report,
}
writeFileSync(join(__dirname, 'reprocess-all-stuck-report.json'), JSON.stringify(out, null, 2))
console.log('\nDONE')
console.log('COUNTS', counts.rows)
console.log('REMAINING', remaining.rows.length)
await c.end()
