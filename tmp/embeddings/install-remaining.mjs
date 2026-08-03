#!/usr/bin/env node
/**
 * Create remaining embedding workflows as stubs via inline node graphs,
 * applied after MCP stub IDs are provided in workflow-ids.json.
 *
 * This script ONLY expands existing stub workflow IDs with full graphs.
 * Usage: node install-remaining.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import pg from 'pg';

const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const AUDIT_ID = 'jtQvQlqRZ5X5WF9I';
const idsPath = new URL('./workflow-ids.json', import.meta.url);
const ids = existsSync(idsPath) ? JSON.parse(readFileSync(idsPath, 'utf8')) : {};
if (!ids.GERAR || !ids.VALIDAR) throw new Error('workflow-ids.json must include GERAR and VALIDAR');

const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

function node(name, type, typeVersion, position, parameters, extra = {}) {
  return {
    id: randomUUID(),
    name,
    type,
    typeVersion,
    position,
    parameters,
    ...extra,
  };
}

function codeNode(name, position, jsCode, extra = {}) {
  return node(name, 'n8n-nodes-base.code', 2, position, {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode,
  }, extra);
}

function pgNode(name, position, query, extra = {}) {
  return node(
    name,
    'n8n-nodes-base.postgres',
    2.6,
    position,
    { operation: 'executeQuery', options: {}, query },
    { credentials: { postgres: PG_CRED }, ...extra }
  );
}

function ifNode(name, position, leftValue) {
  return node(name, 'n8n-nodes-base.if', 2.3, position, {
    conditions: {
      combinator: 'and',
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [
        {
          id: 'c1',
          leftValue,
          rightValue: true,
          operator: { type: 'boolean', operation: 'true' },
        },
      ],
    },
    looseTypeValidation: true,
  });
}

function execWf(name, position, workflowId, cachedResultName, valueMap, extra = {}) {
  return node(
    name,
    'n8n-nodes-base.executeWorkflow',
    1.3,
    position,
    {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: workflowId, cachedResultName },
      workflowInputs: { mappingMode: 'defineBelow', value: valueMap },
      options: { waitForSubWorkflow: true },
    },
    extra
  );
}

function triggerInputs(values) {
  return node('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 100], {
    inputSource: 'workflowInputs',
    workflowInputs: { values },
  });
}

function buildConnections(map) {
  const connections = {};
  for (const [src, targets] of Object.entries(map)) {
    connections[src] = { main: targets.map((t) => (Array.isArray(t) ? t : [t]).map((name) => {
      if (typeof name === 'string') return { node: name, type: 'main', index: 0 };
      return { node: name.node, type: 'main', index: name.index || 0 };
    })) };
  }
  return connections;
}

async function applyGraph(workflowId, nodes, connections, description) {
  const { rows } = await client.query(
    `SELECT "activeVersionId", name FROM workflow_entity WHERE id = $1`,
    [workflowId]
  );
  if (!rows[0]) throw new Error('missing workflow ' + workflowId);
  await client.query(
    `UPDATE workflow_entity SET nodes = $1::json, connections = $2::json, description = COALESCE($3, description), "updatedAt" = NOW() WHERE id = $4`,
    [JSON.stringify(nodes), JSON.stringify(connections), description || null, workflowId]
  );
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
       WHERE "workflowId" = $3 AND "versionId" = $4`,
      [JSON.stringify(nodes), JSON.stringify(connections), workflowId, rows[0].activeVersionId]
    );
  }
  return { id: workflowId, name: rows[0].name, nodeCount: nodes.length };
}

// ---------- ORQUESTRAR ----------
function buildOrquestrar() {
  const nodes = [
    triggerInputs([
      { name: 'versionId', type: 'string' },
      { name: 'documentId', type: 'string' },
      { name: 'requestId', type: 'string' },
      { name: 'userId', type: 'string' },
      { name: 'sessionId', type: 'string' },
      { name: 'force', type: 'boolean' },
    ]),
    codeNode('Preparar contexto', [220, 100], `const crypto = require('crypto');
const t = $input.first().json || {};
const versionId = String(t.versionId || '').trim();
const documentId = String(t.documentId || '').trim();
const requestId = String(t.requestId || '').trim() || crypto.randomUUID();
const userId = String(t.userId || '').trim();
const sessionId = String(t.sessionId || '').trim();
const force = t.force === true || t.force === 'true';
const startedAtMs = Date.now();
if (!versionId) return [{ json: { ok: false, error: 'versionId_required', requestId, startedAtMs } }];
return [{ json: { versionId, documentId, requestId, userId, sessionId, force, startedAtMs, valid: true } }];`),
    ifNode('Contexto ok?', [440, 100], '={{ $json.valid === true }}'),
    codeNode('Erro contexto', [660, -40], `const p = $('Preparar contexto').first().json || {};
return [{ json: { ok: false, status: 'FAILED', error: p.error || 'invalid_input', requestId: p.requestId || '', versionId: p.versionId || '', documentId: p.documentId || '' } }];`),
    execWf('Audit STARTED', [660, 220], AUDIT_ID, 'AUDITORIA - REGISTRAR', {
      requestId: "={{ $('Preparar contexto').first().json.requestId }}",
      userId: "={{ $('Preparar contexto').first().json.userId }}",
      sessionId: "={{ $('Preparar contexto').first().json.sessionId }}",
      action: 'EMBEDDING_STARTED',
      resourceType: 'document_version',
      resourceId: "={{ $('Preparar contexto').first().json.versionId }}",
      success: true,
      method: 'INTERNAL',
      path: '/embeddings/orquestrar',
      statusCode: '={{ 202 }}',
      durationMs: '={{ 0 }}',
      beforeData: '={{ null }}',
      afterData: '={{ null }}',
      metadata: "={{ { versionId: $('Preparar contexto').first().json.versionId, documentId: $('Preparar contexto').first().json.documentId, force: $('Preparar contexto').first().json.force } }}",
      skipAudit: false,
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    codeNode('SQL started invalidate', [880, 220], `const p = $('Preparar contexto').first().json || {};
const vid = String(p.versionId || '').replace(/'/g, "''");
const force = p.force === true;
const inv = force
  ? "UPDATE document_chunks SET embedding_status = 'INVALID', embedding_vector = NULL, embedding_updated_at = now(), embedding_next_retry_at = NULL WHERE document_version_id = '" + vid + "'::uuid AND embedding_status = 'VALID' AND (embedding_hash IS DISTINCT FROM content_hash OR embedding_vector IS NULL) RETURNING id"
  : "SELECT NULL::uuid AS id WHERE false";
const sql = "WITH inv AS (" + inv + "), upd AS (UPDATE document_versions SET embedding_started_at = COALESCE(embedding_started_at, now()), embedding_status = 'PROCESSING' WHERE id = '" + vid + "'::uuid RETURNING id, document_id) SELECT (SELECT COUNT(*)::int FROM inv) AS invalidated, u.id AS \\"versionId\\", u.document_id AS \\"documentId\\" FROM upd u";
return [{ json: { sql } }];`),
    pgNode('Marcar started + invalidate', [1100, 220], '={{ $json.sql }}'),
    pgNode(
      'Carregar pending ids',
      [1320, 220],
      `SELECT id
FROM document_chunks
WHERE document_version_id = '{{ $('Preparar contexto').first().json.versionId }}'::uuid
  AND embedding_status IN ('PENDING','FAILED','INVALID')
  AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())
ORDER BY chunk_order NULLS LAST, id`,
      { alwaysOutputData: true }
    ),
    codeNode('Montar lotes', [1540, 220], `const rows = $input.all().map((i) => i.json).filter((j) => j && j.id);
const ids = rows.map((r) => r.id);
const batchSize = 16;
const batches = [];
for (let i = 0; i < ids.length; i += batchSize) {
  batches.push({ json: { chunkIds: ids.slice(i, i + batchSize), batchIndex: batches.length, totalBatches: Math.ceil(ids.length / batchSize) || 0 } });
}
if (!batches.length) {
  return [{ json: { chunkIds: [], batchIndex: 0, totalBatches: 0, empty: true } }];
}
return batches;`),
    node('Loop lotes', 'n8n-nodes-base.splitInBatches', 3, [1760, 220], { batchSize: 1 }),
    execWf(
      'Chamar GERAR',
      [1980, 100],
      ids.GERAR,
      'EMBEDDING - GERAR',
      {
        chunkIds: '={{ $json.chunkIds }}',
        requestId: "={{ $('Preparar contexto').first().json.requestId }}",
        userId: "={{ $('Preparar contexto').first().json.userId }}",
        sessionId: "={{ $('Preparar contexto').first().json.sessionId }}",
      },
      { onError: 'continueRegularOutput', alwaysOutputData: true }
    ),
    execWf(
      'Chamar VALIDAR',
      [2200, 320],
      ids.VALIDAR,
      'EMBEDDING - VALIDAR',
      { versionId: "={{ $('Preparar contexto').first().json.versionId }}" },
      { executeOnce: true }
    ),
    codeNode('Montar resultado', [2420, 320], `const p = $('Preparar contexto').first().json || {};
const v = $input.first().json || {};
const ok = v.ok === true;
return [{ json: {
  ok,
  status: v.status || (ok ? 'VALID' : 'FAILED'),
  versionId: p.versionId,
  documentId: p.documentId || '',
  requestId: p.requestId,
  total: Number(v.total || 0),
  pending: Number(v.pending || 0),
  processing: Number(v.processing || 0),
  valid: Number(v.valid || 0),
  failed: Number(v.failed || 0),
  invalid: Number(v.invalid || 0),
  skipped: Number(v.skipped || 0),
  durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())),
} }];`),
    ifNode('Embedding ok?', [2640, 320], '={{ $json.ok === true }}'),
    execWf('Audit SUCCESS', [2860, 200], AUDIT_ID, 'AUDITORIA - REGISTRAR', {
      requestId: "={{ $('Montar resultado').first().json.requestId }}",
      userId: "={{ $('Preparar contexto').first().json.userId }}",
      sessionId: "={{ $('Preparar contexto').first().json.sessionId }}",
      action: 'EMBEDDING_SUCCESS',
      resourceType: 'document_version',
      resourceId: "={{ $('Montar resultado').first().json.versionId }}",
      success: true,
      method: 'INTERNAL',
      path: '/embeddings/orquestrar',
      statusCode: '={{ 200 }}',
      durationMs: "={{ $('Montar resultado').first().json.durationMs }}",
      beforeData: '={{ null }}',
      afterData: '={{ null }}',
      metadata: "={{ { status: $('Montar resultado').first().json.status, valid: $('Montar resultado').first().json.valid, skipped: $('Montar resultado').first().json.skipped, total: $('Montar resultado').first().json.total } }}",
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    execWf('Audit FAILED', [2860, 440], AUDIT_ID, 'AUDITORIA - REGISTRAR', {
      requestId: "={{ $('Montar resultado').first().json.requestId }}",
      userId: "={{ $('Preparar contexto').first().json.userId }}",
      sessionId: "={{ $('Preparar contexto').first().json.sessionId }}",
      action: 'EMBEDDING_FAILED',
      resourceType: 'document_version',
      resourceId: "={{ $('Montar resultado').first().json.versionId }}",
      success: false,
      method: 'INTERNAL',
      path: '/embeddings/orquestrar',
      statusCode: '={{ 500 }}',
      durationMs: "={{ $('Montar resultado').first().json.durationMs }}",
      beforeData: '={{ null }}',
      afterData: '={{ null }}',
      errorCode: 'EMBEDDING_FAILED',
      metadata: "={{ { status: $('Montar resultado').first().json.status, pending: $('Montar resultado').first().json.pending, failed: $('Montar resultado').first().json.failed, invalid: $('Montar resultado').first().json.invalid } }}",
    }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
    codeNode('Retorno final', [3080, 320], `const r = $('Montar resultado').first().json || {};
return [{ json: r }];`),
  ];

  const connections = buildConnections({
    Trigger: ['Preparar contexto'],
    'Preparar contexto': ['Contexto ok?'],
    'Contexto ok?': [['Audit STARTED'], ['Erro contexto']],
    'Audit STARTED': ['SQL started invalidate'],
    'SQL started invalidate': ['Marcar started + invalidate'],
    'Marcar started + invalidate': ['Carregar pending ids'],
    'Carregar pending ids': ['Montar lotes'],
    'Montar lotes': ['Loop lotes'],
    'Loop lotes': [['Chamar VALIDAR'], ['Chamar GERAR']],
    'Chamar GERAR': ['Loop lotes'],
    'Chamar VALIDAR': ['Montar resultado'],
    'Montar resultado': ['Embedding ok?'],
    'Embedding ok?': [['Audit SUCCESS'], ['Audit FAILED']], // true / false
    'Audit SUCCESS': ['Retorno final'],
    'Audit FAILED': ['Retorno final'],
  });
  return { nodes, connections };
}

// ---------- REPROCESSAR ----------
function buildReprocessar() {
  const nodes = [
    triggerInputs([
      { name: 'requestId', type: 'string' },
      { name: 'userId', type: 'string' },
      { name: 'sessionId', type: 'string' },
      { name: 'force', type: 'boolean' },
      { name: 'limit', type: 'number' },
    ]),
    codeNode('Preparar', [220, 100], `const crypto = require('crypto');
const t = $input.first().json || {};
return [{ json: {
  requestId: String(t.requestId || '').trim() || crypto.randomUUID(),
  userId: String(t.userId || '').trim(),
  sessionId: String(t.sessionId || '').trim(),
  force: t.force !== false,
  limit: Math.min(50, Math.max(1, Number(t.limit || 20) || 20)),
  startedAtMs: Date.now(),
} }];`),
    pgNode(
      'Buscar versões',
      [440, 100],
      `SELECT DISTINCT dc.document_version_id AS "versionId", dc.document_id AS "documentId"
FROM document_chunks dc
JOIN document_versions dv ON dv.id = dc.document_version_id
WHERE (
  dc.embedding_status IN ('INVALID','FAILED','PENDING')
  OR (dc.embedding_status = 'VALID' AND (dc.embedding_hash IS DISTINCT FROM dc.content_hash OR dc.embedding_vector IS NULL))
)
ORDER BY dc.document_version_id
LIMIT {{ $('Preparar').first().json.limit }}`,
      { alwaysOutputData: true }
    ),
    codeNode('Para itens', [660, 100], `const rows = $input.all().map((i) => i.json).filter((j) => j && j.versionId);
if (!rows.length) return [{ json: { empty: true, versionId: '', documentId: '' } }];
return rows.map((r) => ({ json: { ...r, empty: false } }));`),
    ifNode('Tem versões?', [880, 100], '={{ $json.empty !== true }}'),
    codeNode('Sem trabalho', [1100, -40], `const p = $('Preparar').first().json || {};
return [{ json: { ok: true, processed: 0, requestId: p.requestId, status: 'NOOP' } }];`),
    node('Loop versões', 'n8n-nodes-base.splitInBatches', 3, [1100, 200], { batchSize: 1 }),
    execWf(
      'Chamar ORQUESTRAR',
      [1320, 80],
      ids.ORQUESTRAR,
      'EMBEDDING - ORQUESTRAR',
      {
        versionId: '={{ $json.versionId }}',
        documentId: '={{ $json.documentId }}',
        requestId: "={{ $('Preparar').first().json.requestId }}",
        userId: "={{ $('Preparar').first().json.userId }}",
        sessionId: "={{ $('Preparar').first().json.sessionId }}",
        force: "={{ $('Preparar').first().json.force }}",
      },
      { onError: 'continueRegularOutput', alwaysOutputData: true }
    ),
    execWf('Audit REGENERATED', [1540, 280], AUDIT_ID, 'AUDITORIA - REGISTRAR', {
      requestId: "={{ $('Preparar').first().json.requestId }}",
      userId: "={{ $('Preparar').first().json.userId }}",
      sessionId: "={{ $('Preparar').first().json.sessionId }}",
      action: 'EMBEDDING_REGENERATED',
      resourceType: 'system',
      resourceId: '',
      success: true,
      method: 'INTERNAL',
      path: '/embeddings/reprocess',
      statusCode: '={{ 200 }}',
      durationMs: "={{ Date.now() - $('Preparar').first().json.startedAtMs }}",
      beforeData: '={{ null }}',
      afterData: '={{ null }}',
      metadata: "={{ { mode: 'reprocess' } }}",
    }, { executeOnce: true, onError: 'continueRegularOutput', alwaysOutputData: true }),
    codeNode('Finalizar reprocess', [1760, 280], `const p = $('Preparar').first().json || {};
let processed = 0;
try { processed = $('Chamar ORQUESTRAR').all().length; } catch (_) { processed = 0; }
return [{ json: { ok: true, processed, requestId: p.requestId, status: 'DONE', durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())) } }];`),
  ];
  const connections = buildConnections({
    Trigger: ['Preparar'],
    Preparar: ['Buscar versões'],
    'Buscar versões': ['Para itens'],
    'Para itens': ['Tem versões?'],
    'Tem versões?': [['Loop versões'], ['Sem trabalho']],
    'Loop versões': [['Audit REGENERATED'], ['Chamar ORQUESTRAR']],
    'Chamar ORQUESTRAR': ['Loop versões'],
    'Audit REGENERATED': ['Finalizar reprocess'],
  });
  return { nodes, connections };
}

// ---------- FILA ----------
function buildFila() {
  const nodes = [
    triggerInputs([
      { name: 'requestId', type: 'string' },
      { name: 'userId', type: 'string' },
      { name: 'sessionId', type: 'string' },
    ]),
    codeNode('Preparar fila', [220, 100], `const crypto = require('crypto');
const t = $input.first().json || {};
return [{ json: {
  requestId: String(t.requestId || '').trim() || crypto.randomUUID(),
  userId: String(t.userId || '').trim() || 'system',
  sessionId: String(t.sessionId || '').trim(),
  startedAtMs: Date.now(),
} }];`),
    pgNode(
      'Pick versões',
      [440, 100],
      `SELECT document_version_id AS "versionId", MIN(document_id::text)::uuid AS "documentId", COUNT(*)::int AS pending
FROM document_chunks
WHERE embedding_status IN ('PENDING','FAILED','INVALID')
  AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())
GROUP BY document_version_id
ORDER BY MIN(COALESCE(embedding_next_retry_at, '-infinity'::timestamptz)), document_version_id
LIMIT 3`,
      { alwaysOutputData: true }
    ),
    codeNode('Itens fila', [660, 100], `const rows = $input.all().map((i) => i.json).filter((j) => j && j.versionId);
if (!rows.length) return [{ json: { empty: true } }];
return rows.map((r) => ({ json: { ...r, empty: false } }));`),
    ifNode('Fila vazia?', [880, 100], '={{ $json.empty === true }}'),
    codeNode('Fila noop', [1100, -40], `const p = $('Preparar fila').first().json || {};
return [{ json: { ok: true, processed: 0, requestId: p.requestId, status: 'IDLE' } }];`),
    node('Loop fila', 'n8n-nodes-base.splitInBatches', 3, [1100, 200], { batchSize: 1 }),
    execWf(
      'ORQUESTRAR fila',
      [1320, 80],
      ids.ORQUESTRAR,
      'EMBEDDING - ORQUESTRAR',
      {
        versionId: '={{ $json.versionId }}',
        documentId: '={{ $json.documentId }}',
        requestId: "={{ $('Preparar fila').first().json.requestId }}",
        userId: "={{ $('Preparar fila').first().json.userId }}",
        sessionId: "={{ $('Preparar fila').first().json.sessionId }}",
        force: false,
      },
      { onError: 'continueRegularOutput', alwaysOutputData: true }
    ),
    codeNode('Finalizar fila', [1540, 280], `const p = $('Preparar fila').first().json || {};
let processed = 0;
try { processed = $('ORQUESTRAR fila').all().filter((i) => i.json && i.json.versionId).length; } catch (_) {}
return [{ json: { ok: true, processed, requestId: p.requestId, status: 'DONE', durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())) } }];`),
  ];
  const connections = buildConnections({
    Trigger: ['Preparar fila'],
    'Preparar fila': ['Pick versões'],
    'Pick versões': ['Itens fila'],
    'Itens fila': ['Fila vazia?'],
    'Fila vazia?': [['Fila noop'], ['Loop fila']],
    'Loop fila': [['Finalizar fila'], ['ORQUESTRAR fila']],
    'ORQUESTRAR fila': ['Loop fila'],
  });
  return { nodes, connections };
}

// ---------- Schedule ----------
function buildSchedule() {
  const nodes = [
    node('Every 5 minutes', 'n8n-nodes-base.scheduleTrigger', 1.3, [0, 100], {
      rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] },
    }),
    codeNode('Prep schedule', [220, 100], `const crypto = require('crypto');
return [{ json: { requestId: crypto.randomUUID(), userId: 'system', sessionId: '' } }];`),
    execWf('Chamar FILA', [440, 100], ids.FILA, 'EMBEDDING - FILA', {
      requestId: '={{ $json.requestId }}',
      userId: '={{ $json.userId }}',
      sessionId: '={{ $json.sessionId }}',
    }),
  ];
  const connections = buildConnections({
    'Every 5 minutes': ['Prep schedule'],
    'Prep schedule': ['Chamar FILA'],
  });
  return { nodes, connections };
}

const results = {};
if (ids.ORQUESTRAR) {
  const g = buildOrquestrar();
  results.ORQUESTRAR = await applyGraph(ids.ORQUESTRAR, g.nodes, g.connections, 'Orquestra embedding de uma versão: audit, invalidate(force), lotes GERAR, VALIDAR, audit final.');
}
if (ids.REPROCESSAR) {
  const g = buildReprocessar();
  results.REPROCESSAR = await applyGraph(ids.REPROCESSAR, g.nodes, g.connections, 'Reprocessa versões com embeddings inválidos/mismatched via ORQUESTRAR e audita REGENERATED.');
}
if (ids.FILA) {
  const g = buildFila();
  results.FILA = await applyGraph(ids.FILA, g.nodes, g.connections, 'Consome até 3 versionIds com pending/failed due e chama ORQUESTRAR.');
}
if (ids.SCHEDULE) {
  const g = buildSchedule();
  results.SCHEDULE = await applyGraph(ids.SCHEDULE, g.nodes, g.connections, 'Agenda a cada 5 minutos a execução de EMBEDDING - FILA.');
}

writeFileSync(new URL('./_install-remaining-result.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await client.end();
