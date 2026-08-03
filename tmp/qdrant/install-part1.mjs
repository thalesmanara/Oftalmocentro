#!/usr/bin/env node
/**
 * Etapa 19 — Install Qdrant workflows + patch Processar/Consulta/Health/Backup/Dataset.
 * Pattern mirrors tmp/embeddings/install-remaining.mjs + patch-existing.mjs
 */
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import pg from 'pg';

const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const OAI_CRED = { id: 'g6QTP6n02dss9A0d', name: 'OpenAI account' };
const AUDIT_ID = 'jtQvQlqRZ5X5WF9I';
const NORMALIZE_ID = 'N3zLpj7Dij4n5p5p';
const AUTH_ID = 'P5E43ZXSJiI9wFYD';
const PERM_ID = 'PLACEHOLDER'; // will resolve
const SUCCESS_ID = 'zE5LRjZfbXw8Ymll';
const ERROR_ID = 'PLACEHOLDER2';

const conn =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function codeNode(name, position, jsCode, extra = {}) {
  return node(name, 'n8n-nodes-base.code', 2, position, {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode,
  }, extra);
}
function pgNode(name, position, query, extra = {}) {
  return node(name, 'n8n-nodes-base.postgres', 2.6, position, {
    operation: 'executeQuery',
    options: {},
    query,
  }, { credentials: { postgres: PG_CRED }, ...extra });
}
function ifNode(name, position, leftValue) {
  return node(name, 'n8n-nodes-base.if', 2.3, position, {
    conditions: {
      combinator: 'and',
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{
        id: 'c1',
        leftValue,
        rightValue: true,
        operator: { type: 'boolean', operation: 'true' },
      }],
    },
    looseTypeValidation: true,
  });
}
function execWf(name, position, workflowId, cachedResultName, valueMap, extra = {}) {
  return node(name, 'n8n-nodes-base.executeWorkflow', 1.3, position, {
    mode: 'once',
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: workflowId, cachedResultName },
    workflowInputs: { mappingMode: 'defineBelow', value: valueMap },
    options: { waitForSubWorkflow: true },
  }, extra);
}
function httpNode(name, position, parameters, extra = {}) {
  return node(name, 'n8n-nodes-base.httpRequest', 4.4, position, parameters, {
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    ...extra,
  });
}
function connMain(connections, from, to, outIndex = 0) {
  if (!connections[from]) connections[from] = { main: [[]] };
  while (connections[from].main.length <= outIndex) connections[from].main.push([]);
  connections[from].main[outIndex].push({ node: to, type: 'main', index: 0 });
}
function setTargets(connections, src, sourceIndex, targets) {
  if (!connections[src]) connections[src] = { main: [[]] };
  if (!connections[src].main) connections[src].main = [[]];
  while (connections[src].main.length <= sourceIndex) connections[src].main.push([]);
  connections[src].main[sourceIndex] = targets.map((name) => ({ node: name, type: 'main', index: 0 }));
}

async function resolveIds() {
  const { rows } = await client.query(
    `SELECT id, name FROM workflow_entity WHERE name IN (
      'SYSTEM - PREPARAR ERRO','AUTH - VALIDAR PERMISSÃO','SYSTEM - PREPARAR SUCESSO'
    )`
  );
  const map = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  return {
    errorId: map['SYSTEM - PREPARAR ERRO'],
    permId: map['AUTH - VALIDAR PERMISSÃO'] || map['SYSTEM - VALIDAR PERMISSÃO'],
    successId: map['SYSTEM - PREPARAR SUCESSO'] || SUCCESS_ID,
  };
}

async function upsertWorkflow(name, nodes, connections, settings = {}) {
  const { rows } = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name = $1`, [name]);
  const versionId = randomUUID();
  const now = new Date().toISOString();
  if (rows[0]) {
    const id = rows[0].id;
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW(), active=true,
       settings=COALESCE(settings,'{}'::jsonb) || $3::jsonb WHERE id=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), JSON.stringify(settings), id]
    );
    if (rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
         WHERE "workflowId"=$3 AND "versionId"=$4`,
        [JSON.stringify(nodes), JSON.stringify(connections), id, rows[0].activeVersionId]
      );
    } else {
      await client.query(
        `INSERT INTO workflow_history ("versionId","workflowId",nodes,connections,authors,"createdAt","updatedAt")
         VALUES ($1,$2,$3::json,$4::json,'system',$5,$5)`,
        [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), now]
      );
      await client.query(`UPDATE workflow_entity SET "activeVersionId"=$1 WHERE id=$2`, [versionId, id]);
    }
    return id;
  }
  const id = randomUUID().replace(/-/g, '').slice(0, 16);
  // n8n ids are 16-char alphanumeric; generate similar
  const wfId = [...Array(16)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*62)]).join('');
  await client.query(
    `INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "staticData", "pinData",
      "versionId", "triggerCount", "meta", "parentFolderId", "createdAt", "updatedAt", "isArchived", "versionCounter", "activeVersionId")
     VALUES ($1::varchar, $2::varchar, true, $3::json, $4::json, $5::json, '{}'::json, '{}'::json, $6::varchar, 0, '{}'::json, NULL, $7::timestamptz, $7::timestamptz, false, 1, $6::varchar)`,
    [wfId, name, JSON.stringify(nodes), JSON.stringify(connections), JSON.stringify({ executionOrder: 'v1', ...settings }), versionId, now]
  );
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",nodes,connections,authors,"createdAt","updatedAt")
     VALUES ($1,$2,$3::json,$4::json,'system',$5,$5)`,
    [versionId, wfId, JSON.stringify(nodes), JSON.stringify(connections), now]
  );
  // share with project if shared_workflow exists
  try {
    await client.query(
      `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
       SELECT $1, id, 'workflow:owner', NOW(), NOW() FROM project WHERE type='personal' LIMIT 1
       ON CONFLICT DO NOTHING`,
      [wfId]
    );
  } catch (_) {}
  return wfId;
}

async function load(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id]
  );
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
  };
}
async function save(wf) {
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id]
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId]
    );
  }
}
function upsertNode(nodes, nodeObj) {
  const idx = nodes.findIndex((n) => n.name === nodeObj.name);
  if (idx >= 0) nodes[idx] = { ...nodes[idx], ...nodeObj, id: nodes[idx].id };
  else nodes.push({ id: randomUUID(), ...nodeObj });
}

const ids = {};
const helpers = await resolveIds();
console.log('helpers', helpers);

// ========== QDRANT - UPSERT ==========
{
  const nodes = [
    node('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'versionId', type: 'string' },
        { name: 'documentId', type: 'string' },
        { name: 'chunkIdsJson', type: 'string' },
        { name: 'requestId', type: 'string' },
        { name: 'userId', type: 'string' },
        { name: 'sessionId', type: 'string' },
        { name: 'force', type: 'boolean' },
        { name: 'limit', type: 'number' },
      ]},
    }),
    codeNode('Preparar', [220, 0], `const crypto = require('crypto');
const t = $input.first().json || {};
const versionId = String(t.versionId || '').trim();
const documentId = String(t.documentId || '').trim();
const requestId = String(t.requestId || '').trim() || crypto.randomUUID();
const userId = String(t.userId || '').trim();
const sessionId = String(t.sessionId || '').trim();
const force = t.force === true || t.force === 'true';
let chunkIds = [];
try { chunkIds = JSON.parse(String(t.chunkIdsJson || '[]')); } catch (_) { chunkIds = []; }
if (!Array.isArray(chunkIds)) chunkIds = [];
const limit = Math.min(Math.max(Number(t.limit || 64) || 64, 1), 128);
const startedAtMs = Date.now();
function esc(s){ return String(s ?? '').replace(/'/g, "''"); }
let where = "dc.embedding_status = 'VALID' AND dc.embedding_vector IS NOT NULL";
if (!force) where += " AND (dc.embedding_sync_status IS NULL OR dc.embedding_sync_status IN ('PENDING','FAILED','INVALID') OR dc.qdrant_point_id IS NULL OR dc.embedding_hash IS DISTINCT FROM dc.content_hash)";
if (versionId) where += " AND dc.document_version_id = '" + esc(versionId) + "'::uuid";
if (documentId) where += " AND dc.document_id = '" + esc(documentId) + "'::uuid";
if (chunkIds.length) where += " AND dc.id IN (" + chunkIds.map(id => "'" + esc(id) + "'::uuid").join(',') + ")";
const loadSql = "SELECT dc.id, dc.document_id, dc.document_version_id, dc.chunk_index, dc.chunk_order, dc.chunk_kind, dc.sheet_name, dc.content_hash, dc.embedding_hash, dc.embedding_model, dc.embedding_vector, d.sector_id, d.category_id, d.subcategory_id, COALESCE(dv.title_snapshot, d.title) AS document_title, dv.is_current, dv.ocr_quality_grade FROM document_chunks dc JOIN documents d ON d.id = dc.document_id JOIN document_versions dv ON dv.id = dc.document_version_id WHERE " + where + " ORDER BY dc.chunk_order NULLS LAST, dc.chunk_index NULLS LAST LIMIT " + limit;
return [{ json: { versionId, documentId, requestId, userId, sessionId, force, limit, startedAtMs, loadSql } }];`),
    pgNode('Carregar config', [440, 0],
      "SELECT MAX(CASE WHEN key='qdrant_url' THEN value END) AS url, MAX(CASE WHEN key='qdrant_collection' THEN value END) AS collection, MAX(CASE WHEN key='qdrant_timeout_ms' THEN value END) AS timeout_ms FROM app_secrets WHERE key IN ('qdrant_url','qdrant_collection','qdrant_timeout_ms');"),
    pgNode('Carregar chunks', [660, 0], "={{ $('Preparar').first().json.loadSql }}", { alwaysOutputData: true }),
    codeNode('Montar pontos', [880, 0], `const prep = $('Preparar').first().json || {};
const cfg = $('Carregar config').first().json || {};
const rows = $input.all().map(i => i.json).filter(r => r && r.id);
const url = String(cfg.url || 'http://qdrant:6333').replace(/\\/$/, '');
const collection = String(cfg.collection || 'oftalmocentro_chunks');
const timeoutMs = Number(cfg.timeout_ms || 30000) || 30000;
const points = [];
for (const r of rows) {
  let vec = r.embedding_vector;
  if (typeof vec === 'string') { try { vec = JSON.parse(vec); } catch (_) { vec = null; } }
  if (!Array.isArray(vec) || !vec.length) continue;
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
      chunkIndex: r.chunk_index != null ? Number(r.chunk_index) : (r.chunk_order != null ? Number(r.chunk_order) : null),
      embeddingHash: r.embedding_hash || r.content_hash || null,
      embeddingModel: r.embedding_model || null,
      ocrQuality: r.ocr_quality_grade || null,
      chunkKind: r.chunk_kind || null,
      sheetName: r.sheet_name || null,
      pageNumber: null,
      isCurrent: r.is_current === true,
    },
  });
}
return [{ json: { requestId: prep.requestId, userId: prep.userId, sessionId: prep.sessionId, versionId: prep.versionId, documentId: prep.documentId, startedAtMs: prep.startedAtMs, collection, url: url + '/collections/' + encodeURIComponent(collection) + '/points?wait=true', timeoutMs, count: points.length, pointIds: points.map(p => p.id), body: { points }, skip: points.length === 0 } }];`),
    ifNode('Tem pontos?', [1100, 0], '={{ Number($json.count || 0) > 0 }}'),
    httpNode('Qdrant upsert', [1320, -80], {
      method: 'PUT',
      url: '={{ $json.url }}',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: '={{ $json.body }}',
      options: { timeout: 60000, response: { response: { fullResponse: true, neverError: true } } },
    }),
    codeNode('Persistir resultado', [1540, -80], `const built = $('Montar pontos').first().json || {};
const resp = $input.first().json || {};
const statusCode = Number(resp.statusCode ?? resp.status ?? 0);
let body = resp.body ?? resp.data ?? resp;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
const okHttp = statusCode >= 200 && statusCode < 300 && String(body.status || 'ok').toLowerCase() !== 'error';
const ids = built.pointIds || [];
const syncMs = Math.max(0, Date.now() - Number(built.startedAtMs || Date.now()));
function esc(s){ return String(s ?? '').replace(/'/g, "''"); }
let sql = 'SELECT 0 AS noop WHERE false';
if (!ids.length) return [{ json: { ok: true, synced: 0, failed: 0, skipped: true, requestId: built.requestId, collection: built.collection, syncMs, sql, auditAction: 'QDRANT_UPSERT' } }];
if (okHttp) {
  sql = "UPDATE document_chunks SET qdrant_point_id = id::text, embedding_sync_status = 'SYNCED', embedding_synced_at = now(), embedding_sync_error = NULL, embedding_sync_ms = " + syncMs + ", embedding_hash = COALESCE(embedding_hash, content_hash) WHERE id IN (" + ids.map(id => "'" + esc(id) + "'::uuid").join(',') + ") RETURNING id";
  return [{ json: { ok: true, synced: ids.length, failed: 0, skipped: false, requestId: built.requestId, userId: built.userId, sessionId: built.sessionId, collection: built.collection, syncMs, sql, auditAction: 'QDRANT_UPSERT' } }];
}
const err = esc((body && body.status && body.status.error) || body.message || ('http_' + statusCode) || 'qdrant_upsert_failed').slice(0, 500);
sql = "UPDATE document_chunks SET embedding_sync_status = 'FAILED', embedding_sync_error = '" + err + "', embedding_sync_attempts = COALESCE(embedding_sync_attempts,0) + 1, embedding_sync_ms = " + syncMs + " WHERE id IN (" + ids.map(id => "'" + esc(id) + "'::uuid").join(',') + ") RETURNING id";
return [{ json: { ok: false, synced: 0, failed: ids.length, skipped: false, requestId: built.requestId, userId: built.userId, sessionId: built.sessionId, collection: built.collection, syncMs, sql, error: err, auditAction: 'QDRANT_SYNC_FAILED' } }];`),
    pgNode('Atualizar PG', [1760, -80], '={{ $json.sql }}', { alwaysOutputData: true }),
    execWf('Auditoria', [1980, -80], AUDIT_ID, 'AUDITORIA - REGISTRAR', {
      action: "={{ $('Persistir resultado').first().json.auditAction }}",
      entityType: 'qdrant',
      entityId: "={{ $('Persistir resultado').first().json.collection || 'oftalmocentro_chunks' }}",
      userId: "={{ $('Persistir resultado').first().json.userId || '' }}",
      sessionId: "={{ $('Persistir resultado').first().json.sessionId || '' }}",
      requestId: "={{ $('Persistir resultado').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ synced: $('Persistir resultado').first().json.synced, failed: $('Persistir resultado').first().json.failed, syncMs: $('Persistir resultado').first().json.syncMs, ok: $('Persistir resultado').first().json.ok }) }}",
    }),
    codeNode('Retorno', [2200, -80], `const p = $('Persistir resultado').first().json || {};
return [{ json: { ok: p.ok === true, synced: p.synced || 0, failed: p.failed || 0, skipped: !!p.skipped, collection: p.collection, syncMs: p.syncMs, requestId: p.requestId, error: p.error || null } }];`),
    codeNode('Idle', [1320, 120], `const b = $('Montar pontos').first().json || {};
return [{ json: { ok: true, synced: 0, failed: 0, skipped: true, collection: b.collection, syncMs: 0, requestId: b.requestId } }];`),
  ];
  const connections = {};
  connMain(connections, 'Trigger', 'Preparar');
  connMain(connections, 'Preparar', 'Carregar config');
  connMain(connections, 'Carregar config', 'Carregar chunks');
  connMain(connections, 'Carregar chunks', 'Montar pontos');
  connMain(connections, 'Montar pontos', 'Tem pontos?');
  connMain(connections, 'Tem pontos?', 'Qdrant upsert', 0);
  connMain(connections, 'Tem pontos?', 'Idle', 1);
  connMain(connections, 'Qdrant upsert', 'Persistir resultado');
  connMain(connections, 'Persistir resultado', 'Atualizar PG');
  connMain(connections, 'Atualizar PG', 'Auditoria');
  connMain(connections, 'Auditoria', 'Retorno');
  ids.UPSERT = await upsertWorkflow('QDRANT - UPSERT', nodes, connections);
  console.log('UPSERT', ids.UPSERT);
}

// Continue in part 2 file if needed - write ids so far
writeFileSync(new URL('./workflow-ids.json', import.meta.url), JSON.stringify(ids, null, 2));
console.log('partial ids written');
await client.end();
