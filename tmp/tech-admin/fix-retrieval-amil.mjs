#!/usr/bin/env node
/**
 * Corrige:
 * 1) PUT Documentos — metadata update copia validation/ocr/embeddings e marca VALID
 * 2) IA - RECUPERAR CONTEXTO — lexical aceita PENDING se processed
 * 3) Heal DB PENDING → VALID nas versões current processadas
 * 4) Sync Qdrant da versão current + isCurrent=false nas antigas
 */
import pg from 'pg'
import { writeFileSync, unlinkSync, mkdtempSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const N8N_CID = 'n8n-vrv8r1yp224hzobdqqcenajo'
const PUT_WF = 'Y0MuWEEdoMFts7ay'
const RECUPERAR_WF = 'bae8872eeb164a27'

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

function patchNodes(nodes, patcher) {
  const arr = typeof nodes === 'string' ? JSON.parse(nodes) : structuredClone(nodes)
  let changed = 0
  for (const n of arr) {
    if (patcher(n)) changed++
  }
  return { arr, changed }
}

async function patchWorkflow(wfId, patcher) {
  const ent = await c.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`, [wfId])
  const p = patchNodes(ent.rows[0].nodes, patcher)
  if (p.changed) {
    await c.query(`UPDATE workflow_entity SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE id=$2`, [
      JSON.stringify(p.arr),
      wfId,
    ])
  }
  const hist = await c.query(
    `SELECT "versionId", nodes FROM workflow_history WHERE "workflowId"=$1 ORDER BY "updatedAt" DESC LIMIT 6`,
    [wfId],
  )
  for (const row of hist.rows) {
    const hp = patchNodes(row.nodes, patcher)
    if (hp.changed) {
      await c.query(
        `UPDATE workflow_history SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
        [JSON.stringify(hp.arr), wfId, row.versionId],
      )
    }
  }
  return p.changed
}

// --- 1) Fix PUT Documentos SQL ---
const NEW_PUT_SQL = `WITH input AS (
  SELECT
    COALESCE(
      NULLIF('{{ $json.body.id || "" }}', '')::uuid,
      NULLIF('{{ $json.body.documentId || "" }}', '')::uuid
    ) AS document_id,
    NULLIF('{{ ($json.body.title || "").replace(/'/g, "''") }}', '') AS title,
    NULLIF('{{ $json.body.sectorId || "" }}', '')::uuid AS sector_id,
    NULLIF('{{ $json.body.categoryId || "" }}', '')::uuid AS category_id,
    CASE WHEN '{{ $json.body.subcategoryId !== undefined }}' = 'true'
      THEN NULLIF('{{ $json.body.subcategoryId || "" }}', '')::uuid ELSE NULL END AS subcategory_id,
    '{{ $json.body.subcategoryId !== undefined }}' = 'true' AS subcategory_provided,
    CASE WHEN '{{ $json.body.semanticDescription !== undefined }}' = 'true'
      THEN NULLIF('{{ ($json.body.semanticDescription || "").replace(/'/g, "''") }}', '') ELSE NULL END AS description,
    '{{ $json.body.semanticDescription !== undefined }}' = 'true' AS description_provided,
    CASE WHEN '{{ $json.body.expirationDate !== undefined }}' = 'true'
      THEN NULLIF('{{ $json.body.expirationDate || "" }}', '')::date ELSE NULL END AS expiration_date,
    '{{ $json.body.expirationDate !== undefined }}' = 'true' AS expiration_provided,
    CASE WHEN '{{ $json.body.responsibleUserId !== undefined }}' = 'true'
      THEN NULLIF('{{ $json.body.responsibleUserId || "" }}', '')::uuid ELSE NULL END AS responsible_user_id,
    '{{ $json.body.responsibleUserId !== undefined }}' = 'true' AS responsible_provided,
    NULLIF('{{ $json.body.updatedBy || "" }}', '')::uuid AS updated_by
),
cur AS (
  SELECT dv.*
  FROM document_versions dv
  JOIN input i ON i.document_id = dv.document_id
  WHERE dv.is_current = true
  LIMIT 1
),
ins AS (
  INSERT INTO document_versions (
    document_id, version_number, is_current, status,
    file_name, file_path, file_size, mime_type, checksum,
    title_snapshot, description_snapshot,
    sector_id_snapshot, category_id_snapshot, subcategory_id_snapshot,
    responsible_user_id_snapshot, expiration_date,
    extracted_text, processing_status, created_by, metadata,
    original_file_name, stored_file_name, file_extension, browser_mime_type, detected_mime_type,
    checksum_algorithm, validation_status, validation_error_code, validated_at, page_count,
    ocr_status, ocr_engine, extraction_method, sheet_count, table_row_count, table_column_count,
    table_summary, table_preview,
    embedding_status, embedding_model, embedding_dimensions,
    embedding_pending_count, embedding_valid_count, embedding_failed_count,
    qdrant_sync_status, qdrant_synced_count, qdrant_pending_count, qdrant_failed_count, qdrant_collection
  )
  SELECT
    c.document_id,
    (SELECT COALESCE(MAX(dv2.version_number), 0) + 1 FROM document_versions dv2 WHERE dv2.document_id = c.document_id),
    false,
    CASE WHEN COALESCE(c.processing_status, '') = 'processed' THEN 'READY' ELSE COALESCE(c.status, 'READY') END,
    c.file_name, c.file_path, c.file_size, c.mime_type, c.checksum,
    COALESCE(i.title, c.title_snapshot),
    CASE WHEN i.description_provided THEN i.description ELSE c.description_snapshot END,
    COALESCE(i.sector_id, c.sector_id_snapshot),
    COALESCE(i.category_id, c.category_id_snapshot),
    CASE WHEN i.subcategory_provided THEN i.subcategory_id ELSE c.subcategory_id_snapshot END,
    CASE WHEN i.responsible_provided THEN i.responsible_user_id ELSE c.responsible_user_id_snapshot END,
    CASE WHEN i.expiration_provided THEN i.expiration_date ELSE c.expiration_date END,
    c.extracted_text,
    c.processing_status,
    COALESCE(i.updated_by, c.created_by),
    jsonb_build_object('source', 'metadata_update', 'previousVersionId', c.id, 'previousVersionNumber', c.version_number),
    c.original_file_name, c.stored_file_name, c.file_extension, c.browser_mime_type, c.detected_mime_type,
    c.checksum_algorithm,
    CASE
      WHEN COALESCE(c.processing_status,'') = 'processed'
        AND COALESCE(c.validation_status,'VALID') IN ('VALID','PENDING')
        AND length(coalesce(c.extracted_text,'')) > 0
      THEN 'VALID'
      ELSE COALESCE(c.validation_status, 'PENDING')
    END,
    CASE
      WHEN COALESCE(c.processing_status,'') = 'processed'
        AND COALESCE(c.validation_status,'VALID') IN ('VALID','PENDING')
        AND length(coalesce(c.extracted_text,'')) > 0
      THEN NULL
      ELSE c.validation_error_code
    END,
    CASE
      WHEN COALESCE(c.processing_status,'') = 'processed'
        AND COALESCE(c.validation_status,'VALID') IN ('VALID','PENDING')
        AND length(coalesce(c.extracted_text,'')) > 0
      THEN COALESCE(c.validated_at, NOW())
      ELSE c.validated_at
    END,
    c.page_count,
    COALESCE(c.ocr_status, 'NOT_REQUIRED'), c.ocr_engine, c.extraction_method,
    c.sheet_count, c.table_row_count, c.table_column_count, c.table_summary, c.table_preview,
    c.embedding_status, c.embedding_model, c.embedding_dimensions,
    c.embedding_pending_count, c.embedding_valid_count, c.embedding_failed_count,
    c.qdrant_sync_status, c.qdrant_synced_count, c.qdrant_pending_count, c.qdrant_failed_count, c.qdrant_collection
  FROM cur c
  CROSS JOIN input i
  RETURNING *
),
copied AS (
  INSERT INTO document_chunks (
    document_id, document_version_id, chunk_order, chunk_text, chunk_index, chunk_kind,
    sheet_name, row_start, row_end, headers_json, content_hash, qdrant_point_id,
    embedding_model, embedding_dimensions, embedding_status, embedding_created_at, embedding_updated_at,
    embedding_hash, embedding_version, embedding_generation_ms, embedding_token_count, embedding_vector,
    embedding_attempts, embedding_last_error, embedding_next_retry_at,
    embedding_synced_at, embedding_sync_status, embedding_sync_error, embedding_sync_attempts, embedding_sync_ms
  )
  SELECT
    c.document_id, i.id, dc.chunk_order, dc.chunk_text, dc.chunk_index, dc.chunk_kind,
    dc.sheet_name, dc.row_start, dc.row_end, dc.headers_json, dc.content_hash, NULL,
    dc.embedding_model, dc.embedding_dimensions, dc.embedding_status, dc.embedding_created_at, dc.embedding_updated_at,
    dc.embedding_hash, dc.embedding_version, dc.embedding_generation_ms, dc.embedding_token_count, dc.embedding_vector,
    dc.embedding_attempts, dc.embedding_last_error, dc.embedding_next_retry_at,
    NULL, 'PENDING', NULL, 0, NULL
  FROM document_chunks dc
  JOIN cur c ON dc.document_version_id = c.id
  CROSS JOIN ins i
  RETURNING id
),
promoted AS (
  SELECT sync_document_from_version(ins.id) AS ok, ins.id AS version_id, ins.document_id
  FROM ins
)
SELECT
  d.id,
  d.title,
  d.sector_id AS "sectorId",
  s.name AS "sectorName",
  d.category_id AS "categoryId",
  c.name AS "categoryName",
  c.description AS "categoryDescription",
  d.subcategory_id AS "subcategoryId",
  sc.name AS "subcategoryName",
  sc.description AS "subcategoryDescription",
  d.semantic_description AS "semanticDescription",
  d.expiration_date AS "expirationDate",
  COALESCE(d.is_active, TRUE) AS "isActive",
  d.file_name AS "fileName",
  d.file_type AS "fileType",
  d.file_size AS "fileSize",
  d.file_path AS "filePath",
  d.extracted_text AS "extractedText",
  d.processing_status AS "processingStatus",
  d.processed_at AS "processedAt",
  d.responsible_user_id AS "responsibleUserId",
  ru.name AS "responsibleUserName",
  d.created_by AS "createdBy",
  cb.name AS "createdByName",
  d.updated_by AS "updatedBy",
  ub.name AS "updatedByName",
  d.created_at AS "createdAt",
  d.updated_at AS "updatedAt",
  d.current_version_id AS "currentVersionId",
  d.current_version_number AS "currentVersionNumber"
FROM documents d
JOIN promoted p ON p.document_id = d.id
LEFT JOIN sectors s ON s.id = d.sector_id
LEFT JOIN categories c ON c.id = d.category_id
LEFT JOIN subcategories sc ON sc.id = d.subcategory_id
LEFT JOIN users ru ON ru.id = d.responsible_user_id
LEFT JOIN users cb ON cb.id = d.created_by
LEFT JOIN users ub ON ub.id = d.updated_by;`

const putChanged = await patchWorkflow(PUT_WF, (n) => {
  if (n.name === 'Execute a SQL query' && n.parameters?.query?.includes('metadata_update')) {
    n.parameters.query = NEW_PUT_SQL
    return true
  }
  return false
})
console.log('PUT Documentos patched', putChanged)

// --- 2) Soften lexical validation filter ---
const lexicalChanged = await patchWorkflow(RECUPERAR_WF, (n) => {
  if (n.name !== 'Buscar chunks relevantes' || !n.parameters?.query) return false
  const old = `AND COALESCE(dv.validation_status, 'VALID') = 'VALID'`
  const neu = `AND (\n      COALESCE(dv.validation_status, 'VALID') = 'VALID'\n      OR (\n        COALESCE(dv.processing_status, d.processing_status) = 'processed'\n        AND COALESCE(dv.validation_status, 'PENDING') = 'PENDING'\n        AND length(coalesce(dv.extracted_text, d.extracted_text, '')) > 0\n      )\n    )`
  if (!n.parameters.query.includes(old)) return false
  n.parameters.query = n.parameters.query.replace(old, neu)
  return true
})
console.log('RECUPERAR lexical patched', lexicalChanged)

// --- 3) Heal PENDING current processed ---
const heal = await c.query(`
  UPDATE document_versions dv
  SET validation_status = 'VALID',
      validation_error_code = NULL,
      validated_at = COALESCE(validated_at, NOW()),
      ocr_status = COALESCE(ocr_status, 'NOT_REQUIRED')
  FROM documents d
  WHERE dv.id = d.current_version_id
    AND d.deleted_at IS NULL
    AND d.is_active = true
    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'
    AND COALESCE(dv.validation_status, 'PENDING') = 'PENDING'
    AND length(coalesce(dv.extracted_text, '')) > 0
  RETURNING dv.id, d.title
`)
console.log('healed validation', heal.rowCount, heal.rows.map((r) => r.title))

// --- 4) Sync current unsynced chunks to Qdrant ---
const { rows: cfgRows } = await c.query(`
  SELECT MAX(CASE WHEN key='qdrant_url' THEN value END) AS url,
         MAX(CASE WHEN key='qdrant_collection' THEN value END) AS collection
  FROM app_secrets WHERE key IN ('qdrant_url','qdrant_collection')
`)
const collection = cfgRows[0]?.collection || 'oftalmocentro_chunks'
const qdrantUrl = (cfgRows[0]?.url || 'http://qdrant:6333').replace(/\/$/, '')

const { rows: unsynced } = await c.query(`
  SELECT dc.id, dc.document_id, dc.document_version_id, dc.chunk_index, dc.chunk_order,
         dc.chunk_kind, dc.sheet_name, dc.content_hash, dc.embedding_hash, dc.embedding_model,
         dc.embedding_vector, d.sector_id, d.category_id, d.subcategory_id, d.is_active,
         COALESCE(dv.title_snapshot, d.title) AS document_title, dv.is_current, dv.ocr_quality_grade
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  JOIN document_versions dv ON dv.id = dc.document_version_id
  WHERE d.deleted_at IS NULL
    AND dv.is_current = true
    AND dc.embedding_status = 'VALID'
    AND dc.embedding_vector IS NOT NULL
    AND COALESCE(dc.embedding_sync_status,'') <> 'SYNCED'
  ORDER BY d.title, dc.chunk_order NULLS LAST
`)
console.log('current unsynced', unsynced.length)

const workDir = mkdtempSync(join(tmpdir(), 'qdrant-fix-'))
let batchSeq = 0
function upsertViaN8n(points) {
  const body = JSON.stringify({ points })
  const local = join(workDir, `batch-${++batchSeq}.json`)
  writeFileSync(local, body)
  const remoteHost = `/tmp/qdrant-fix-${batchSeq}.json`
  const remoteCtr = `/tmp/qdrant-fix.json`
  execFileSync('scp', [local, `oftalmocentro:${remoteHost}`], { timeout: 120000 })
  const url = `${qdrantUrl}/collections/${collection}/points?wait=true`
  const nodeScript = `const http=require('http');const fs=require('fs');const raw=fs.readFileSync('${remoteCtr}');const u=new URL(process.argv[1]);const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:'PUT',headers:{'Content-Type':'application/json','Content-Length':raw.length},timeout:180000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(JSON.stringify({status:res.statusCode,body:Buffer.concat(c).toString('utf8').slice(0,400)})));});req.on('error',e=>{console.error(String(e));process.exit(1);});req.write(raw);req.end();`
  const cmd = [
    `docker cp ${remoteHost} ${N8N_CID}:${remoteCtr}`,
    `docker exec ${N8N_CID} node -e ${JSON.stringify(nodeScript)} ${JSON.stringify(url)}`,
    `rm -f ${remoteHost}`,
  ].join(' && ')
  const out = execFileSync('ssh', ['oftalmocentro', cmd], { maxBuffer: 2 * 1024 * 1024, timeout: 180000 }).toString('utf8')
  try { unlinkSync(local) } catch {}
  return JSON.parse(out)
}

const points = []
for (const r of unsynced) {
  let vec = r.embedding_vector
  if (typeof vec === 'string') {
    try { vec = JSON.parse(vec) } catch { vec = null }
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
      chunkIndex: r.chunk_index != null ? Number(r.chunk_index) : r.chunk_order != null ? Number(r.chunk_order) : null,
      embeddingHash: r.embedding_hash || r.content_hash || null,
      embeddingModel: r.embedding_model || null,
      ocrQuality: r.ocr_quality_grade || null,
      chunkKind: r.chunk_kind || null,
      sheetName: r.sheet_name || null,
      pageNumber: null,
      isCurrent: true,
      isActive: r.is_active === true,
    },
  })
}

let synced = 0
let failed = 0
for (let i = 0; i < points.length; i += 24) {
  const batch = points.slice(i, i + 24)
  console.log(`upsert current ${i + 1}-${i + batch.length}/${points.length}`)
  const res = upsertViaN8n(batch)
  console.log(' ', res.status, String(res.body || '').slice(0, 100))
  const ids = batch.map((p) => p.id)
  if (res.status >= 200 && res.status < 300) {
    await c.query(
      `UPDATE document_chunks
       SET qdrant_point_id = id::text,
           embedding_sync_status='SYNCED',
           embedding_synced_at=now(),
           embedding_sync_error=NULL
       WHERE id = ANY($1::uuid[])`,
      [ids],
    )
    synced += ids.length
  } else {
    failed += ids.length
  }
}
console.log('synced', synced, 'failed', failed)

// --- 5) Mark stale Qdrant points isCurrent=false for non-current versions ---
const { rows: stale } = await c.query(`
  SELECT DISTINCT dc.qdrant_point_id
  FROM document_chunks dc
  JOIN document_versions dv ON dv.id = dc.document_version_id
  WHERE dc.qdrant_point_id IS NOT NULL
    AND dv.is_current = false
  LIMIT 5000
`)
console.log('stale point ids', stale.length)

// Also find points in Qdrant for non-current Amil version by scrolling and setting isCurrent false via set payload
const staleScript = `
const http=require('http');
function req(method,path,body){return new Promise((res,rej)=>{const data=body?JSON.stringify(body):null;const r=http.request({hostname:'qdrant',port:6333,path,method,headers:data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}},x=>{const c=[];x.on('data',d=>c.push(d));x.on('end',()=>{try{res({status:x.statusCode,json:JSON.parse(Buffer.concat(c).toString())})}catch(e){res({status:x.statusCode,raw:Buffer.concat(c).toString().slice(0,300)})}});});r.on('error',rej);if(data)r.write(data);r.end();});}
(async()=>{
  const ids=${JSON.stringify(stale.map((r) => r.qdrant_point_id).filter(Boolean).slice(0, 2000))};
  if(!ids.length){ console.log(JSON.stringify({updated:0})); return; }
  // batch set payload isCurrent=false
  let updated=0;
  for(let i=0;i<ids.length;i+=64){
    const batch=ids.slice(i,i+64);
    const body={points:batch,payload:{isCurrent:false}};
    const r=await req('POST','/collections/oftalmocentro_chunks/points/payload?wait=true',body);
    if(r.status>=200&&r.status<300) updated+=batch.length;
    else console.error('payload fail', r.status, JSON.stringify(r.json||r.raw).slice(0,200));
  }
  console.log(JSON.stringify({updated}));
})().catch(e=>{console.error(String(e)); process.exit(1);});
`
const staleOut = execFileSync('ssh', ['oftalmocentro', `docker exec -i ${N8N_CID} node`], {
  input: staleScript,
  maxBuffer: 2 * 1024 * 1024,
  timeout: 180000,
}).toString('utf8')
console.log('stale payload', staleOut.trim())

await c.query(`
  UPDATE document_versions v
  SET qdrant_synced_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED'),
      qdrant_pending_count=(SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND COALESCE(c.embedding_sync_status,'')<>'SYNCED'),
      qdrant_collection=$1,
      qdrant_sync_status=CASE
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)=0 THEN qdrant_sync_status
        WHEN (SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id)
           =(SELECT COUNT(*) FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_sync_status='SYNCED')
        THEN 'SYNCED' ELSE 'PENDING' END
  WHERE v.is_current=true
`, [collection])

const amil = await c.query(`
  SELECT d.title, dv.validation_status, dv.is_current, dv.qdrant_sync_status,
         (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=dv.id AND c.embedding_sync_status='SYNCED') synced
  FROM documents d JOIN document_versions dv ON dv.id=d.current_version_id
  WHERE d.id='dc78b735-671c-4037-82ab-7c7f5dc0bcad'
`)
console.log('amil after', amil.rows[0])

writeFileSync(
  new URL('./fix-retrieval-amil-report.json', import.meta.url),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      putChanged,
      lexicalChanged,
      healed: heal.rows,
      upsertSynced: synced,
      upsertFailed: failed,
      staleOut: staleOut.trim(),
      amil: amil.rows[0],
    },
    null,
    2,
  ),
)

await c.end()
console.log('DONE')
