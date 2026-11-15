#!/usr/bin/env node
import pg from 'pg'
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'

const N8N_CID = 'n8n-vrv8r1yp224hzobdqqcenajo'
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

const { rows: cfgRows } = await c.query(`
  SELECT MAX(CASE WHEN key='qdrant_url' THEN value END) AS url,
         MAX(CASE WHEN key='qdrant_collection' THEN value END) AS collection
  FROM app_secrets
  WHERE key IN ('qdrant_url','qdrant_collection')
`)
const collection = cfgRows[0]?.collection || 'oftalmocentro_chunks'
const qdrantUrl = (cfgRows[0]?.url || 'http://qdrant:6333').replace(/\/$/, '')
console.log('qdrant', qdrantUrl, collection)

const { rows } = await c.query(`
  SELECT dc.id, dc.document_id, dc.document_version_id, dc.chunk_index, dc.chunk_order,
         dc.chunk_kind, dc.sheet_name, dc.content_hash, dc.embedding_hash, dc.embedding_model,
         dc.embedding_vector, d.sector_id, d.category_id, d.subcategory_id, d.is_active,
         COALESCE(dv.title_snapshot, d.title) AS document_title, dv.is_current, dv.ocr_quality_grade
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  JOIN document_versions dv ON dv.id = dc.document_version_id
  WHERE d.deleted_at IS NULL
    AND dc.embedding_status = 'VALID'
    AND dc.embedding_vector IS NOT NULL
    AND COALESCE(dc.embedding_sync_status,'') <> 'SYNCED'
  ORDER BY d.created_at, dc.chunk_order NULLS LAST, dc.chunk_index NULLS LAST
`)
console.log('unsynced points', rows.length)

const workDir = mkdtempSync(join(tmpdir(), 'qdrant-sync-'))
let batchSeq = 0

function upsertViaN8n(points) {
  const body = JSON.stringify({ points })
  const local = join(workDir, `batch-${++batchSeq}.json`)
  writeFileSync(local, body)
  const remoteHost = `/tmp/qdrant-batch-${batchSeq}.json`
  const remoteCtr = `/tmp/qdrant-batch.json`
  execFileSync('scp', [local, `oftalmocentro:${remoteHost}`], { timeout: 120000 })
  const url = `${qdrantUrl}/collections/${collection}/points?wait=true`
  const nodeScript = `const http=require('http');const fs=require('fs');const raw=fs.readFileSync('${remoteCtr}');const u=new URL(process.argv[1]);const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:'PUT',headers:{'Content-Type':'application/json','Content-Length':raw.length},timeout:180000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(JSON.stringify({status:res.statusCode,body:Buffer.concat(c).toString('utf8').slice(0,500)})));});req.on('error',e=>{console.error(String(e));process.exit(1);});req.write(raw);req.end();`
  const cmd = [
    `docker cp ${remoteHost} ${N8N_CID}:${remoteCtr}`,
    `docker exec ${N8N_CID} node -e ${JSON.stringify(nodeScript)} ${JSON.stringify(url)}`,
    `rm -f ${remoteHost}`,
  ].join(' && ')
  const out = execFileSync('ssh', ['oftalmocentro', cmd], {
    maxBuffer: 2 * 1024 * 1024,
    timeout: 180000,
  }).toString('utf8')
  try {
    unlinkSync(local)
  } catch {}
  return JSON.parse(out)
}

const points = []
for (const r of rows) {
  let vec = r.embedding_vector
  if (typeof vec === 'string') {
    try {
      vec = JSON.parse(vec)
    } catch {
      vec = null
    }
  }
  if (!Array.isArray(vec) || !vec.length) continue
  points.push({
    id: String(r.id),
    vector: vec,
    payload: {
      chunkId: String(r.id),
      documentId: String(r.document_id || ''),
      documentVersionId: String(r.document_version_id || ''),
      sectorId: r.sector_id || null,
      categoryId: r.category_id || null,
      subcategoryId: r.subcategory_id || null,
      documentTitle: r.document_title || null,
      chunkIndex:
        r.chunk_index != null ? Number(r.chunk_index) : r.chunk_order != null ? Number(r.chunk_order) : null,
      embeddingHash: r.embedding_hash || r.content_hash || null,
      embeddingModel: r.embedding_model || null,
      ocrQuality: r.ocr_quality_grade || null,
      chunkKind: r.chunk_kind || null,
      sheetName: r.sheet_name || null,
      pageNumber: null,
      isCurrent: r.is_current === true,
      isActive: r.is_active === true,
    },
  })
}
console.log('points ready', points.length)

const batchSize = 24
let synced = 0
let failed = 0
for (let i = 0; i < points.length; i += batchSize) {
  const batch = points.slice(i, i + batchSize)
  console.log(`upsert ${i + 1}-${i + batch.length}/${points.length}`)
  const res = upsertViaN8n(batch)
  console.log(' ', res.status, String(res.body || '').slice(0, 120))
  const ok = res.status >= 200 && res.status < 300
  const ids = batch.map((p) => p.id)
  if (ok) {
    await c.query(
      `UPDATE document_chunks
       SET qdrant_point_id = id::text,
           embedding_sync_status = 'SYNCED',
           embedding_synced_at = now(),
           embedding_sync_error = NULL,
           embedding_hash = COALESCE(embedding_hash, content_hash)
       WHERE id = ANY($1::uuid[])`,
      [ids],
    )
    synced += ids.length
  } else {
    await c.query(
      `UPDATE document_chunks
       SET embedding_sync_status = 'FAILED',
           embedding_sync_error = left($2,500),
           embedding_sync_attempts = COALESCE(embedding_sync_attempts,0)+1
       WHERE id = ANY($1::uuid[])`,
      [ids, String(res.body || res.status)],
    )
    failed += ids.length
  }
}

await c.query(`
  UPDATE document_versions v
  SET qdrant_synced_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'),
      qdrant_pending_count = (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND COALESCE(c.embedding_sync_status,'')<>'SYNCED'),
      qdrant_collection = $1,
      qdrant_sync_status = CASE
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)=0 THEN qdrant_sync_status
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)
           = (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED')
        THEN 'SYNCED' ELSE 'PENDING' END,
      qdrant_synced_at = CASE
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)
           = (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED')
        THEN NOW() ELSE qdrant_synced_at END
  WHERE EXISTS (SELECT 1 FROM document_chunks c WHERE c.document_version_id=v.id)
`, [collection])

await c.query(`UPDATE users SET is_technical_admin=false, updated_at=NOW() WHERE email='compras@oftalmocentrouberaba.com.br'`)

const summary = await c.query(`
  SELECT
    COUNT(*)::int docs,
    COUNT(*) FILTER (WHERE d.processing_status='processed')::int processed,
    COUNT(*) FILTER (WHERE d.processing_status='processing')::int processing,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id))::int chunks,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID'))::int valid,
    SUM((SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'))::int synced
  FROM documents d JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
`)

const out = {
  at: new Date().toISOString(),
  upsertSynced: synced,
  upsertFailed: failed,
  summary: summary.rows[0],
}
writeFileSync(new URL('./sync-all-qdrant-report.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('\nDONE', out)
await c.end()
