#!/usr/bin/env node
/**
 * Expand Qdrant stubs + patch Processar/Consulta IA/Health/Backup/Dataset.
 */
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import pg from 'pg';

const IDS = {
  UPSERT: 'ihR1aNY04ZgeW0lm',
  ORQUESTRAR: '7d7ZE8O6DjqMAk2d',
  VALIDAR: 'q3ntUS5qHRsitZA0',
  DELETE: 'L61YCjalRxpWU9Un',
  REINDEXAR: 'UrDNrDkE9WuwEK7H',
  BUSCAR: 'YDnrXjzYUOrZVE6N',
};
const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const OAI = { id: 'g6QTP6n02dss9A0d', name: 'OpenAI account' };
const AUDIT = 'jtQvQlqRZ5X5WF9I';

const client = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function N(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function code(name, pos, jsCode, extra = {}) {
  return N(name, 'n8n-nodes-base.code', 2, pos, { mode: 'runOnceForAllItems', language: 'javaScript', jsCode }, extra);
}
function pgn(name, pos, query, extra = {}) {
  return N(name, 'n8n-nodes-base.postgres', 2.6, pos, { operation: 'executeQuery', options: {}, query }, { credentials: { postgres: PG }, ...extra });
}
function iff(name, pos, leftValue) {
  return N(name, 'n8n-nodes-base.if', 2.3, pos, {
    conditions: {
      combinator: 'and',
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c1', leftValue, rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
    },
    looseTypeValidation: true,
  });
}
function exec(name, pos, workflowId, cachedResultName, value, extra = {}) {
  return N(name, 'n8n-nodes-base.executeWorkflow', 1.3, pos, {
    mode: 'once', source: 'database',
    workflowId: { __rl: true, mode: 'id', value: workflowId, cachedResultName },
    workflowInputs: { mappingMode: 'defineBelow', value },
    options: { waitForSubWorkflow: true },
  }, extra);
}
function http(name, pos, parameters, extra = {}) {
  return N(name, 'n8n-nodes-base.httpRequest', 4.4, pos, parameters, { alwaysOutputData: true, onError: 'continueRegularOutput', ...extra });
}
function link(c, from, to, out = 0) {
  if (!c[from]) c[from] = { main: [[]] };
  while (c[from].main.length <= out) c[from].main.push([]);
  c[from].main[out].push({ node: to, type: 'main', index: 0 });
}
function setTargets(c, src, idx, targets) {
  if (!c[src]) c[src] = { main: [[]] };
  if (!c[src].main) c[src].main = [[]];
  while (c[src].main.length <= idx) c[src].main.push([]);
  c[src].main[idx] = targets.map((n) => ({ node: n, type: 'main', index: 0 }));
}
async function saveGraph(id, nodes, connections) {
  const { rows } = await client.query(`SELECT "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(nodes), JSON.stringify(connections), id,
  ]);
  if (rows[0]?.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), id, rows[0].activeVersionId]
    );
  }
}
function upsertNode(nodes, node) {
  const i = nodes.findIndex((n) => n.name === node.name);
  if (i >= 0) nodes[i] = { ...nodes[i], ...node, id: nodes[i].id };
  else nodes.push({ id: randomUUID(), ...node });
}
async function load(id) {
  const { rows } = await client.query(`SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
  };
}
async function save(wf) {
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id,
  ]);
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId]
    );
  }
}

const results = { ids: IDS };

// ---- UPSERT (reuse graph from install-part1 conceptually) ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'versionId', type: 'string' }, { name: 'documentId', type: 'string' },
        { name: 'chunkIdsJson', type: 'string' }, { name: 'requestId', type: 'string' },
        { name: 'userId', type: 'string' }, { name: 'sessionId', type: 'string' },
        { name: 'force', type: 'boolean' }, { name: 'limit', type: 'number' },
      ]},
    }),
    code('Preparar', [220, 0], `const crypto=require('crypto');const t=$input.first().json||{};const versionId=String(t.versionId||'').trim();const documentId=String(t.documentId||'').trim();const requestId=String(t.requestId||'').trim()||crypto.randomUUID();const userId=String(t.userId||'').trim();const sessionId=String(t.sessionId||'').trim();const force=t.force===true||t.force==='true';let chunkIds=[];try{chunkIds=JSON.parse(String(t.chunkIdsJson||'[]'));}catch(_){chunkIds=[];}if(!Array.isArray(chunkIds))chunkIds=[];const limit=Math.min(Math.max(Number(t.limit||64)||64,1),128);const startedAtMs=Date.now();function esc(s){return String(s??'').replace(/'/g,"''");}let where="dc.embedding_status='VALID' AND dc.embedding_vector IS NOT NULL";if(!force)where+=" AND (dc.embedding_sync_status IS NULL OR dc.embedding_sync_status IN ('PENDING','FAILED','INVALID') OR dc.qdrant_point_id IS NULL OR dc.embedding_hash IS DISTINCT FROM dc.content_hash)";if(versionId)where+=" AND dc.document_version_id='"+esc(versionId)+"'::uuid";if(documentId)where+=" AND dc.document_id='"+esc(documentId)+"'::uuid";if(chunkIds.length)where+=" AND dc.id IN ("+chunkIds.map(id=>"'"+esc(id)+"'::uuid").join(',')+")";const loadSql="SELECT dc.id, dc.document_id, dc.document_version_id, dc.chunk_index, dc.chunk_order, dc.chunk_kind, dc.sheet_name, dc.content_hash, dc.embedding_hash, dc.embedding_model, dc.embedding_vector, d.sector_id, d.category_id, d.subcategory_id, COALESCE(dv.title_snapshot, d.title) AS document_title, dv.is_current, dv.ocr_quality_grade FROM document_chunks dc JOIN documents d ON d.id=dc.document_id JOIN document_versions dv ON dv.id=dc.document_version_id WHERE "+where+" ORDER BY dc.chunk_order NULLS LAST, dc.chunk_index NULLS LAST LIMIT "+limit;return [{json:{versionId,documentId,requestId,userId,sessionId,force,limit,startedAtMs,loadSql}}];`),
    pgn('Carregar config', [440, 0], "SELECT MAX(CASE WHEN key='qdrant_url' THEN value END) AS url, MAX(CASE WHEN key='qdrant_collection' THEN value END) AS collection, MAX(CASE WHEN key='qdrant_timeout_ms' THEN value END) AS timeout_ms FROM app_secrets WHERE key IN ('qdrant_url','qdrant_collection','qdrant_timeout_ms');"),
    pgn('Carregar chunks', [660, 0], "={{ $('Preparar').first().json.loadSql }}", { alwaysOutputData: true }),
    code('Montar pontos', [880, 0], `const prep=$('Preparar').first().json||{};const cfg=$('Carregar config').first().json||{};const rows=$input.all().map(i=>i.json).filter(r=>r&&r.id);const url=String(cfg.url||'http://qdrant:6333').replace(/\\/$/,'');const collection=String(cfg.collection||'oftalmocentro_chunks');const timeoutMs=Number(cfg.timeout_ms||30000)||30000;const points=[];for(const r of rows){let vec=r.embedding_vector;if(typeof vec==='string'){try{vec=JSON.parse(vec);}catch(_){vec=null;}}if(!Array.isArray(vec)||!vec.length)continue;points.push({id:String(r.id),vector:vec,payload:{chunkId:String(r.id),documentId:String(r.document_id||''),documentVersionId:String(r.document_version_id||''),sectorId:r.sector_id||null,categoryId:r.category_id||null,subcategoryId:r.subcategory_id||null,documentTitle:r.document_title||null,chunkIndex:r.chunk_index!=null?Number(r.chunk_index):(r.chunk_order!=null?Number(r.chunk_order):null),embeddingHash:r.embedding_hash||r.content_hash||null,embeddingModel:r.embedding_model||null,ocrQuality:r.ocr_quality_grade||null,chunkKind:r.chunk_kind||null,sheetName:r.sheet_name||null,pageNumber:null,isCurrent:r.is_current===true}});}return [{json:{requestId:prep.requestId,userId:prep.userId,sessionId:prep.sessionId,versionId:prep.versionId,documentId:prep.documentId,startedAtMs:prep.startedAtMs,collection,url:url+'/collections/'+encodeURIComponent(collection)+'/points?wait=true',timeoutMs,count:points.length,pointIds:points.map(p=>p.id),body:{points},skip:points.length===0}}];`),
    iff('Tem pontos?', [1100, 0], '={{ Number($json.count || 0) > 0 }}'),
    http('Qdrant upsert', [1320, -80], { method: 'PUT', url: '={{ $json.url }}', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '={{ $json.body }}', options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } } }),
    code('Persistir resultado', [1540, -80], `const built=$('Montar pontos').first().json||{};const resp=$input.first().json||{};const statusCode=Number(resp.statusCode??resp.status??0);let body=resp.body??resp.data??resp;if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}const okHttp=statusCode>=200&&statusCode<300&&String(body.status||'ok').toLowerCase()!=='error';const ids=built.pointIds||[];const syncMs=Math.max(0,Date.now()-Number(built.startedAtMs||Date.now()));function esc(s){return String(s??'').replace(/'/g,"''");}let sql='SELECT 0 AS noop WHERE false';if(!ids.length)return [{json:{ok:true,synced:0,failed:0,skipped:true,requestId:built.requestId,collection:built.collection,syncMs,sql,auditAction:'QDRANT_UPSERT'}}];if(okHttp){sql="UPDATE document_chunks SET qdrant_point_id=id::text, embedding_sync_status='SYNCED', embedding_synced_at=now(), embedding_sync_error=NULL, embedding_sync_ms="+syncMs+", embedding_hash=COALESCE(embedding_hash, content_hash) WHERE id IN ("+ids.map(id=>"'"+esc(id)+"'::uuid").join(',')+") RETURNING id";return [{json:{ok:true,synced:ids.length,failed:0,skipped:false,requestId:built.requestId,userId:built.userId,sessionId:built.sessionId,collection:built.collection,syncMs,sql,auditAction:'QDRANT_UPSERT'}}];}const err=esc((body&&body.status&&body.status.error)||body.message||('http_'+statusCode)||'qdrant_upsert_failed').slice(0,500);sql="UPDATE document_chunks SET embedding_sync_status='FAILED', embedding_sync_error='"+err+"', embedding_sync_attempts=COALESCE(embedding_sync_attempts,0)+1, embedding_sync_ms="+syncMs+" WHERE id IN ("+ids.map(id=>"'"+esc(id)+"'::uuid").join(',')+") RETURNING id";return [{json:{ok:false,synced:0,failed:ids.length,skipped:false,requestId:built.requestId,userId:built.userId,sessionId:built.sessionId,collection:built.collection,syncMs,sql,error:err,auditAction:'QDRANT_SYNC_FAILED'}}];`),
    pgn('Atualizar PG', [1760, -80], '={{ $json.sql }}', { alwaysOutputData: true }),
    exec('Auditoria', [1980, -80], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: "={{ $('Persistir resultado').first().json.auditAction }}",
      entityType: 'qdrant',
      entityId: "={{ $('Persistir resultado').first().json.collection || 'oftalmocentro_chunks' }}",
      userId: "={{ $('Persistir resultado').first().json.userId || '' }}",
      sessionId: "={{ $('Persistir resultado').first().json.sessionId || '' }}",
      requestId: "={{ $('Persistir resultado').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ synced: $('Persistir resultado').first().json.synced, failed: $('Persistir resultado').first().json.failed, syncMs: $('Persistir resultado').first().json.syncMs, ok: $('Persistir resultado').first().json.ok }) }}",
    }),
    code('Retorno', [2200, -80], `const p=$('Persistir resultado').first().json||{};return [{json:{ok:p.ok===true,synced:p.synced||0,failed:p.failed||0,skipped:!!p.skipped,collection:p.collection,syncMs:p.syncMs,requestId:p.requestId,error:p.error||null}}];`),
    code('Idle', [1320, 120], `const b=$('Montar pontos').first().json||{};return [{json:{ok:true,synced:0,failed:0,skipped:true,collection:b.collection,syncMs:0,requestId:b.requestId}}];`),
  ];
  const c = {};
  link(c,'Trigger','Preparar'); link(c,'Preparar','Carregar config'); link(c,'Carregar config','Carregar chunks');
  link(c,'Carregar chunks','Montar pontos'); link(c,'Montar pontos','Tem pontos?');
  link(c,'Tem pontos?','Qdrant upsert',0); link(c,'Tem pontos?','Idle',1);
  link(c,'Qdrant upsert','Persistir resultado'); link(c,'Persistir resultado','Atualizar PG');
  link(c,'Atualizar PG','Auditoria'); link(c,'Auditoria','Retorno');
  await saveGraph(IDS.UPSERT, nodes, c);
  results.UPSERT = true;
}

// ---- VALIDAR ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [{ name: 'versionId', type: 'string' }, { name: 'requestId', type: 'string' }] },
    }),
    pgn('Agregar', [220, 0], `=WITH stats AS (
  SELECT COUNT(*) FILTER (WHERE embedding_status='VALID')::int AS total_valid,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='SYNCED')::int AS synced,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND (embedding_sync_status IS NULL OR embedding_sync_status IN ('PENDING','INVALID','PROCESSING')))::int AS pending,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='FAILED')::int AS failed
  FROM document_chunks WHERE document_version_id = '{{ $json.versionId }}'::uuid
), upd AS (
  UPDATE document_versions dv SET
    qdrant_synced_count = s.synced, qdrant_pending_count = s.pending, qdrant_failed_count = s.failed,
    qdrant_collection = COALESCE(dv.qdrant_collection, (SELECT value FROM app_secrets WHERE key='qdrant_collection' LIMIT 1)),
    qdrant_sync_status = CASE WHEN s.total_valid=0 THEN 'SKIPPED' WHEN s.pending=0 AND s.failed=0 THEN 'SYNCED' WHEN s.failed>0 THEN 'FAILED' ELSE 'PENDING' END,
    qdrant_synced_at = CASE WHEN s.pending=0 AND s.failed=0 AND s.total_valid>0 THEN now() ELSE dv.qdrant_synced_at END
  FROM stats s WHERE dv.id = '{{ $json.versionId }}'::uuid
  RETURNING dv.qdrant_sync_status, s.total_valid, s.synced, s.pending, s.failed
)
SELECT *, (pending=0 AND failed=0) AS ok FROM upd;`),
    code('Retorno', [440, 0], `const r=$input.first().json||{};const ok=r.ok===true||r.ok==='t'||r.ok===1;return [{json:{ok,status:r.qdrant_sync_status||(ok?'SYNCED':'PENDING'),totalValid:Number(r.total_valid||0),synced:Number(r.synced||0),pending:Number(r.pending||0),failed:Number(r.failed||0),requestId:$('Trigger').first().json.requestId||''}}];`),
  ];
  const c = {}; link(c,'Trigger','Agregar'); link(c,'Agregar','Retorno');
  await saveGraph(IDS.VALIDAR, nodes, c);
  results.VALIDAR = true;
}

// ---- ORQUESTRAR ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'versionId', type: 'string' }, { name: 'documentId', type: 'string' },
        { name: 'requestId', type: 'string' }, { name: 'userId', type: 'string' },
        { name: 'sessionId', type: 'string' }, { name: 'force', type: 'boolean' },
      ]},
    }),
    code('Preparar', [220, 0], `const crypto=require('crypto');const t=$input.first().json||{};const versionId=String(t.versionId||'').trim();const documentId=String(t.documentId||'').trim();const requestId=String(t.requestId||'').trim()||crypto.randomUUID();const userId=String(t.userId||'').trim();const sessionId=String(t.sessionId||'').trim();const force=t.force===true||t.force==='true';if(!versionId)return [{json:{ok:false,valid:false,error:'versionId_required',requestId}}];return [{json:{ok:true,valid:true,versionId,documentId,requestId,userId,sessionId,force,startedAtMs:Date.now()}}];`),
    iff('Contexto ok?', [440, 0], '={{ $json.valid === true }}'),
    code('Erro', [660, 120], `const t=$input.first().json||{};return [{json:{ok:false,status:'INVALID',error:t.error||'invalid'}}];`),
    exec('Audit START', [660, -80], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'QDRANT_UPSERT', entityType: 'document_version',
      entityId: "={{ $('Preparar').first().json.versionId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      requestId: "={{ $('Preparar').first().json.requestId }}",
      metadata: "={{ JSON.stringify({ phase: 'started', force: $('Preparar').first().json.force }) }}",
    }),
    http('Ensure collection', [880, -80], {
      method: 'PUT',
      url: "={{ 'http://qdrant:6333/collections/' + (($('Preparar').first().json.collection) || 'oftalmocentro_chunks') }}",
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: '={{ { vectors: { size: 1536, distance: "Cosine" } } }}',
      options: { timeout: 15000, response: { response: { fullResponse: true, neverError: true } } },
    }),
    exec('Chamar UPSERT', [1100, -80], IDS.UPSERT, 'QDRANT - UPSERT', {
      versionId: "={{ $('Preparar').first().json.versionId }}",
      documentId: "={{ $('Preparar').first().json.documentId || '' }}",
      chunkIdsJson: '[]',
      requestId: "={{ $('Preparar').first().json.requestId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      force: "={{ $('Preparar').first().json.force }}",
      limit: 128,
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    exec('Chamar UPSERT 2', [1320, -80], IDS.UPSERT, 'QDRANT - UPSERT', {
      versionId: "={{ $('Preparar').first().json.versionId }}",
      documentId: "={{ $('Preparar').first().json.documentId || '' }}",
      chunkIdsJson: '[]',
      requestId: "={{ $('Preparar').first().json.requestId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      force: false,
      limit: 128,
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    exec('Chamar UPSERT 3', [1540, -80], IDS.UPSERT, 'QDRANT - UPSERT', {
      versionId: "={{ $('Preparar').first().json.versionId }}",
      documentId: "={{ $('Preparar').first().json.documentId || '' }}",
      chunkIdsJson: '[]',
      requestId: "={{ $('Preparar').first().json.requestId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      force: false,
      limit: 128,
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    exec('Chamar VALIDAR', [1760, -80], IDS.VALIDAR, 'QDRANT - VALIDAR', {
      versionId: "={{ $('Preparar').first().json.versionId }}",
      requestId: "={{ $('Preparar').first().json.requestId }}",
    }),
    code('Montar resultado', [1980, -80], `const v=$input.first().json||{};const ok=v.ok===true;return [{json:{ok,status:v.status||(ok?'SYNCED':'FAILED'),synced:v.synced||0,pending:v.pending||0,failed:v.failed||0,requestId:$('Preparar').first().json.requestId,versionId:$('Preparar').first().json.versionId}}];`),
    iff('Sync ok?', [2200, -80], '={{ $json.ok === true }}'),
    exec('Audit OK', [2420, -160], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'QDRANT_UPSERT', entityType: 'document_version',
      entityId: "={{ $('Preparar').first().json.versionId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      requestId: "={{ $('Preparar').first().json.requestId }}",
      metadata: "={{ JSON.stringify({ phase: 'success', synced: $('Montar resultado').first().json.synced }) }}",
    }),
    exec('Audit FAIL', [2420, 0], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'QDRANT_SYNC_FAILED', entityType: 'document_version',
      entityId: "={{ $('Preparar').first().json.versionId }}",
      userId: "={{ $('Preparar').first().json.userId || '' }}",
      sessionId: "={{ $('Preparar').first().json.sessionId || '' }}",
      requestId: "={{ $('Preparar').first().json.requestId }}",
      metadata: "={{ JSON.stringify({ phase: 'failed', pending: $('Montar resultado').first().json.pending, failed: $('Montar resultado').first().json.failed }) }}",
    }),
    code('Retorno OK', [2640, -160], `return [{json:$('Montar resultado').first().json}];`),
    code('Retorno FAIL', [2640, 0], `return [{json:$('Montar resultado').first().json}];`),
  ];
  const c = {};
  link(c,'Trigger','Preparar'); link(c,'Preparar','Contexto ok?');
  link(c,'Contexto ok?','Audit START',0); link(c,'Contexto ok?','Erro',1);
  link(c,'Audit START','Ensure collection'); link(c,'Ensure collection','Chamar UPSERT');
  link(c,'Chamar UPSERT','Chamar UPSERT 2'); link(c,'Chamar UPSERT 2','Chamar UPSERT 3');
  link(c,'Chamar UPSERT 3','Chamar VALIDAR'); link(c,'Chamar VALIDAR','Montar resultado');
  link(c,'Montar resultado','Sync ok?');
  link(c,'Sync ok?','Audit OK',0); link(c,'Sync ok?','Audit FAIL',1);
  link(c,'Audit OK','Retorno OK'); link(c,'Audit FAIL','Retorno FAIL');
  await saveGraph(IDS.ORQUESTRAR, nodes, c);
  results.ORQUESTRAR = true;
}

// ---- BUSCAR ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'queryVectorJson', type: 'string' }, { name: 'topK', type: 'number' },
        { name: 'categoryId', type: 'string' }, { name: 'subcategoryId', type: 'string' },
      ]},
    }),
    code('Preparar busca', [220, 0], `const t=$input.first().json||{};let vector=[];try{vector=JSON.parse(String(t.queryVectorJson||'[]'));}catch(_){vector=[];}const topK=Math.min(Math.max(Number(t.topK||12)||12,1),50);const categoryId=String(t.categoryId||'').trim();const subcategoryId=String(t.subcategoryId||'').trim();const must=[{key:'isCurrent',match:{value:true}}];if(subcategoryId)must.push({key:'subcategoryId',match:{value:subcategoryId}});else if(categoryId)must.push({key:'categoryId',match:{value:categoryId}});const body={vector,limit:topK,with_payload:true,filter:{must}};return [{json:{ok:Array.isArray(vector)&&vector.length>0,url:'http://qdrant:6333/collections/oftalmocentro_chunks/points/search',body,topK}}];`),
    iff('Vector ok?', [440, 0], '={{ $json.ok === true }}'),
    http('Qdrant search', [660, -80], {
      method: 'POST', url: '={{ $json.url }}', sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: '={{ $json.body }}',
      options: { timeout: 20000, response: { response: { fullResponse: true, neverError: true } } },
    }),
    code('Normalizar hits', [880, -80], `const resp=$input.first().json||{};const statusCode=Number(resp.statusCode??resp.status??0);let body=resp.body??resp.data??resp;if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}const ok=statusCode>=200&&statusCode<300;const raw=Array.isArray(body.result)?body.result:(Array.isArray(body)?body:[]);const hits=raw.map(h=>{const p=h.payload||{};return{chunkId:String(p.chunkId||h.id||''),documentId:p.documentId||null,documentVersionId:p.documentVersionId||null,documentTitle:p.documentTitle||null,sectorId:p.sectorId||null,categoryId:p.categoryId||null,subcategoryId:p.subcategoryId||null,chunkIndex:p.chunkIndex??null,chunkKind:p.chunkKind||null,sheetName:p.sheetName||null,ocrQuality:p.ocrQuality||null,vectorScore:Number(h.score||0),isCurrent:p.isCurrent===true};}).filter(h=>h.chunkId);return [{json:{ok,hits,count:hits.length,retrievalMode:'vector'}}];`),
    code('Vazio', [660, 120], `return [{json:{ok:false,hits:[],count:0,retrievalMode:'vector',error:'invalid_vector'}}];`),
  ];
  const c = {};
  link(c,'Trigger','Preparar busca'); link(c,'Preparar busca','Vector ok?');
  link(c,'Vector ok?','Qdrant search',0); link(c,'Vector ok?','Vazio',1);
  link(c,'Qdrant search','Normalizar hits');
  await saveGraph(IDS.BUSCAR, nodes, c);
  results.BUSCAR = true;
}

// ---- REINDEXAR ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'scope', type: 'string' }, { name: 'versionId', type: 'string' },
        { name: 'documentId', type: 'string' }, { name: 'chunkId', type: 'string' },
        { name: 'requestId', type: 'string' }, { name: 'userId', type: 'string' },
        { name: 'sessionId', type: 'string' }, { name: 'force', type: 'boolean' },
      ]},
    }),
    code('Marcar pending SQL', [220, 0], `const t=$input.first().json||{};const scope=String(t.scope||'document').toLowerCase();function esc(s){return String(s??'').replace(/'/g,"''");}let where='FALSE';if(scope==='chunk'&&t.chunkId)where="id='"+esc(t.chunkId)+"'::uuid";else if(scope==='version'&&t.versionId)where="document_version_id='"+esc(t.versionId)+"'::uuid";else if(scope==='document'&&t.documentId)where="document_id='"+esc(t.documentId)+"'::uuid";else if(scope==='all')where="embedding_status='VALID'";const sql="UPDATE document_chunks SET embedding_sync_status='PENDING', embedding_sync_error=NULL WHERE embedding_status='VALID' AND ("+where+") RETURNING id, document_version_id, document_id";return [{json:{...t,scope,sql,requestId:String(t.requestId||'')}}];`),
    pgn('Invalidar sync', [440, 0], '={{ $json.sql }}', { alwaysOutputData: true }),
    exec('Audit REINDEX', [660, 0], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'QDRANT_REINDEX', entityType: 'qdrant',
      entityId: "={{ $('Marcar pending SQL').first().json.documentId || $('Marcar pending SQL').first().json.versionId || 'all' }}",
      userId: "={{ $('Marcar pending SQL').first().json.userId || '' }}",
      sessionId: "={{ $('Marcar pending SQL').first().json.sessionId || '' }}",
      requestId: "={{ $('Marcar pending SQL').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ scope: $('Marcar pending SQL').first().json.scope }) }}",
    }),
    code('Escolher orquestrar', [880, 0], `const t=$('Marcar pending SQL').first().json||{};const rows=$('Invalidar sync').all().map(i=>i.json).filter(r=>r&&r.id);const versionId=String(t.versionId||(rows[0]&&rows[0].document_version_id)||'').trim();const documentId=String(t.documentId||(rows[0]&&rows[0].document_id)||'').trim();return [{json:{versionId,documentId,requestId:t.requestId,userId:t.userId,sessionId:t.sessionId,force:true,marked:rows.length,hasVersion:!!versionId}}];`),
    iff('Tem version?', [1100, 0], '={{ $json.hasVersion === true }}'),
    exec('ORQUESTRAR', [1320, -80], IDS.ORQUESTRAR, 'QDRANT - ORQUESTRAR', {
      versionId: '={{ $json.versionId }}', documentId: '={{ $json.documentId }}',
      requestId: '={{ $json.requestId }}', userId: '={{ $json.userId }}', sessionId: '={{ $json.sessionId }}', force: true,
    }),
    exec('UPSERT all pending', [1320, 120], IDS.UPSERT, 'QDRANT - UPSERT', {
      versionId: '', documentId: '', chunkIdsJson: '[]',
      requestId: '={{ $json.requestId }}', userId: '={{ $json.userId }}', sessionId: '={{ $json.sessionId }}',
      force: false, limit: 128,
    }),
    code('Retorno', [1540, 0], `const prev=$('Escolher orquestrar').first().json||{};const r=$input.first().json||{};return [{json:{ok:r.ok!==false,marked:prev.marked,synced:r.synced||0,status:r.status||'DONE',requestId:prev.requestId}}];`),
  ];
  const c = {};
  link(c,'Trigger','Marcar pending SQL'); link(c,'Marcar pending SQL','Invalidar sync');
  link(c,'Invalidar sync','Audit REINDEX'); link(c,'Audit REINDEX','Escolher orquestrar');
  link(c,'Escolher orquestrar','Tem version?');
  link(c,'Tem version?','ORQUESTRAR',0); link(c,'Tem version?','UPSERT all pending',1);
  link(c,'ORQUESTRAR','Retorno'); link(c,'UPSERT all pending','Retorno');
  await saveGraph(IDS.REINDEXAR, nodes, c);
  results.REINDEXAR = true;
}

// ---- DELETE (minimal) ----
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'chunkIdsJson', type: 'string' }, { name: 'versionId', type: 'string' },
        { name: 'documentId', type: 'string' }, { name: 'requestId', type: 'string' },
        { name: 'userId', type: 'string' }, { name: 'sessionId', type: 'string' },
      ]},
    }),
    code('Preparar delete', [220, 0], `const t=$input.first().json||{};let ids=[];try{ids=JSON.parse(String(t.chunkIdsJson||'[]'));}catch(_){ids=[];}function esc(s){return String(s??'').replace(/'/g,"''");}let loadSql="SELECT id::text AS id, qdrant_point_id FROM document_chunks WHERE qdrant_point_id IS NOT NULL";if(ids.length)loadSql+=" AND id IN ("+ids.map(i=>"'"+esc(i)+"'::uuid").join(',')+")";else if(t.versionId)loadSql+=" AND document_version_id='"+esc(t.versionId)+"'::uuid";else if(t.documentId)loadSql+=" AND document_id='"+esc(t.documentId)+"'::uuid";else loadSql+=" AND FALSE";return [{json:{...t,loadSql,requestId:String(t.requestId||'')}}];`),
    pgn('Listar pontos', [440, 0], '={{ $json.loadSql }}', { alwaysOutputData: true }),
    code('Montar delete', [660, 0], `const prep=$('Preparar delete').first().json||{};const rows=$input.all().map(i=>i.json).filter(r=>r&&(r.id||r.qdrant_point_id));const points=rows.map(r=>r.qdrant_point_id||r.id);const ids=rows.map(r=>r.id);return [{json:{points,ids,url:'http://qdrant:6333/collections/oftalmocentro_chunks/points/delete?wait=true',body:{points},count:points.length,requestId:prep.requestId,userId:prep.userId,sessionId:prep.sessionId,skip:points.length===0}}];`),
    iff('Tem pontos?', [880, 0], '={{ Number($json.count||0) > 0 }}'),
    http('Qdrant delete', [1100, -80], { method: 'POST', url: '={{ $json.url }}', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '={{ $json.body }}', options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } } }),
    code('SQL clear', [1320, -80], `const m=$('Montar delete').first().json||{};function esc(s){return String(s??'').replace(/'/g,"''");}const ids=m.ids||[];const sql=ids.length?("UPDATE document_chunks SET qdrant_point_id=NULL, embedding_sync_status='PENDING', embedding_synced_at=NULL WHERE id IN ("+ids.map(i=>"'"+esc(i)+"'::uuid").join(',')+") RETURNING id"):"SELECT 0 WHERE false";return [{json:{ok:true,deleted:ids.length,sql,requestId:m.requestId,userId:m.userId,sessionId:m.sessionId}}];`),
    pgn('Clear PG', [1540, -80], '={{ $json.sql }}', { alwaysOutputData: true }),
    exec('Audit DELETE', [1760, -80], AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'QDRANT_DELETE', entityType: 'qdrant', entityId: 'oftalmocentro_chunks',
      userId: "={{ $('SQL clear').first().json.userId || '' }}",
      sessionId: "={{ $('SQL clear').first().json.sessionId || '' }}",
      requestId: "={{ $('SQL clear').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ deleted: $('SQL clear').first().json.deleted }) }}",
    }),
    code('Retorno', [1980, -80], `const s=$('SQL clear').first().json||{};return [{json:{ok:true,deleted:s.deleted||0}}];`),
    code('Idle', [1100, 120], `return [{json:{ok:true,deleted:0,skipped:true}}];`),
  ];
  const c = {};
  link(c,'Trigger','Preparar delete'); link(c,'Preparar delete','Listar pontos'); link(c,'Listar pontos','Montar delete');
  link(c,'Montar delete','Tem pontos?'); link(c,'Tem pontos?','Qdrant delete',0); link(c,'Tem pontos?','Idle',1);
  link(c,'Qdrant delete','SQL clear'); link(c,'SQL clear','Clear PG'); link(c,'Clear PG','Audit DELETE'); link(c,'Audit DELETE','Retorno');
  await saveGraph(IDS.DELETE, nodes, c);
  results.DELETE = true;
}

writeFileSync(new URL('./workflow-ids.json', import.meta.url), JSON.stringify(IDS, null, 2));
writeFileSync(new URL('./_expand-core.json', import.meta.url), JSON.stringify(results, null, 2));
console.log('core expanded', results);
await client.end();
