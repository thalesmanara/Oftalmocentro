#!/usr/bin/env node
/** Build update_workflow ops to replace GERAR stub with full graph. */
import { writeFileSync } from 'fs';

const js = {
  normalizar: `const item = $input.first().json || {};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let ids = item.chunkIds;
if (typeof ids === 'string') {
  try { ids = JSON.parse(ids); } catch (_) { ids = ids.split(/[\\s,]+/); }
}
if (!Array.isArray(ids)) ids = [];
const chunkIds = [...new Set(ids.map((x) => String(x || '').trim()).filter((x) => UUID_RE.test(x)))];
const requestId = String(item.requestId || '').trim();
const userId = String(item.userId || '').trim();
const sessionId = String(item.sessionId || '').trim();
const startedAtMs = Date.now();
if (!chunkIds.length) {
  return [{ json: { ok: true, empty: true, requestId, userId, sessionId, startedAtMs, total: 0, skippedValid: 0, skippedEmpty: 0, generated: 0, failed: 0, pending: 0 } }];
}
const idList = chunkIds.map((id) => "'" + id.replace(/'/g, "''") + "'::uuid").join(',');
const loadSql =
  'SELECT id, document_id AS "documentId", document_version_id AS "versionId", ' +
  "COALESCE(chunk_text, '') AS \\"chunkText\\", content_hash AS \\"contentHash\\", " +
  'embedding_status AS "embeddingStatus", embedding_hash AS "embeddingHash", ' +
  'embedding_attempts AS "embeddingAttempts", ' +
  '(embedding_vector IS NOT NULL) AS "hasVector" ' +
  'FROM document_chunks WHERE id IN (' + idList + ')';
return [{ json: { ok: true, empty: false, chunkIds, idList, loadSql, requestId, userId, sessionId, startedAtMs } }];`,

  classificar: `const norm = $('Normalizar entrada').first().json || {};
const secrets = $('Carregar secrets').first().json || {};
const rows = $input.all().map((i) => i.json).filter((j) => j && j.id);
const model = String(secrets.model || 'text-embedding-3-small');
const dimensions = Number(secrets.dimensions || 1536) || 1536;
const maxRetries = Number(secrets.max_retries || 3) || 3;
const engineVersion = Number(String(secrets.engine_version || '1').split('.')[0]) || 1;
const timeoutMs = Number(secrets.timeout_ms || 60000) || 60000;
const skippedValid = [];
const skippedEmpty = [];
const toProcess = [];
for (const row of rows) {
  const text = String(row.chunkText || '').trim();
  const contentHash = String(row.contentHash || '').trim();
  const status = String(row.embeddingStatus || '');
  const embHash = String(row.embeddingHash || '').trim();
  const hasVector = row.hasVector === true || row.hasVector === 't' || row.hasVector === 'true';
  if (!text) { skippedEmpty.push(row.id); continue; }
  if (status === 'VALID' && hasVector && contentHash && embHash && contentHash === embHash) {
    skippedValid.push(row.id); continue;
  }
  toProcess.push({ id: row.id, text, contentHash });
}
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
let markSkippedSql = 'SELECT 0 AS noop WHERE false';
if (skippedEmpty.length) {
  markSkippedSql = "UPDATE document_chunks SET embedding_status = 'SKIPPED', embedding_vector = NULL, embedding_hash = NULL, embedding_updated_at = now(), embedding_last_error = NULL, embedding_next_retry_at = NULL WHERE id IN (" + skippedEmpty.map((id) => "'" + esc(id) + "'::uuid").join(',') + ") RETURNING id";
}
let markProcessingSql = 'SELECT 0 AS noop WHERE false';
if (toProcess.length) {
  markProcessingSql = "UPDATE document_chunks SET embedding_status = 'PROCESSING', embedding_updated_at = now(), embedding_last_error = NULL WHERE id IN (" + toProcess.map((c) => "'" + esc(c.id) + "'::uuid").join(',') + ") RETURNING id";
}
const openaiBody = { model, input: toProcess.map((c) => c.text), dimensions };
return [{ json: { requestId: norm.requestId, userId: norm.userId, sessionId: norm.sessionId, startedAtMs: norm.startedAtMs, model, dimensions, maxRetries, engineVersion, timeoutMs, total: rows.length, skippedValid: skippedValid.length, skippedEmpty: skippedEmpty.length, toProcessCount: toProcess.length, toProcessIds: toProcess.map((c) => c.id), toProcessHashes: toProcess.map((c) => c.contentHash), markSkippedSql, markProcessingSql, openaiBody, hasWork: toProcess.length > 0 } }];`,

  processar: `const cls = $('Classificar chunks').first().json || {};
const resp = $input.first().json || {};
const statusCode = Number(resp.statusCode ?? resp.status ?? 0);
let body = resp.body ?? resp.data ?? resp;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
const okHttp = statusCode >= 200 && statusCode < 300;
const data = Array.isArray(body && body.data) ? body.data : [];
const ids = cls.toProcessIds || [];
const hashes = cls.toProcessHashes || [];
const generationMs = Math.max(0, Date.now() - Number(cls.startedAtMs || Date.now()));
const tokenCount = body && body.usage ? Number(body.usage.total_tokens || body.usage.prompt_tokens || 0) : 0;
const dimensions = Number(cls.dimensions || 1536) || 1536;
const model = String(cls.model || 'text-embedding-3-small');
const engineVersion = Number(cls.engineVersion || 1) || 1;
const maxRetries = Number(cls.maxRetries || 3) || 3;
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
let persistSql = 'SELECT 0 AS noop WHERE false';
let failSql = 'SELECT 0 AS noop WHERE false';
let generated = 0;
let failed = 0;
if (okHttp && data.length) {
  const byIndex = new Map();
  for (const item of data) byIndex.set(Number(item.index), item.embedding);
  const values = [];
  for (let i = 0; i < ids.length; i++) {
    const emb = byIndex.get(i);
    if (!Array.isArray(emb) || !emb.length) { failed += 1; continue; }
    generated += 1;
    const vectorJson = JSON.stringify(emb).replace(/'/g, "''");
    const hash = esc(hashes[i] || '');
    values.push("('" + esc(ids[i]) + "'::uuid, '" + vectorJson + "'::jsonb, '" + hash + "', '" + esc(model) + "', " + dimensions + ", " + engineVersion + ", " + generationMs + ", " + (tokenCount || 'NULL') + ")");
  }
  if (values.length) {
    persistSql = "UPDATE document_chunks AS dc SET embedding_vector = v.vec, embedding_status = 'VALID', embedding_hash = v.content_hash, content_hash = COALESCE(NULLIF(dc.content_hash, ''), v.content_hash), embedding_model = v.model, embedding_dimensions = v.dims, embedding_version = v.eng_ver, embedding_generation_ms = v.gen_ms, embedding_token_count = v.tokens, embedding_created_at = COALESCE(dc.embedding_created_at, now()), embedding_updated_at = now(), embedding_last_error = NULL, embedding_next_retry_at = NULL FROM (VALUES " + values.join(',') + ") AS v(id, vec, content_hash, model, dims, eng_ver, gen_ms, tokens) WHERE dc.id = v.id RETURNING dc.id";
  }
  const missingIds = ids.filter((_, i) => !byIndex.has(i) || !Array.isArray(byIndex.get(i)) || !byIndex.get(i).length);
  if (missingIds.length) {
    failSql = "UPDATE document_chunks SET embedding_attempts = embedding_attempts + 1, embedding_last_error = 'missing_embedding_in_response', embedding_status = CASE WHEN embedding_attempts + 1 >= " + maxRetries + " THEN 'FAILED' ELSE 'PENDING' END, embedding_next_retry_at = now() + ((POWER(2, LEAST(embedding_attempts + 1, 6))::int || ' minutes')::interval), embedding_updated_at = now(), embedding_vector = NULL WHERE id IN (" + missingIds.map((id) => "'" + esc(id) + "'::uuid").join(',') + ") RETURNING id, embedding_status";
  }
} else {
  failed = ids.length;
  const errMsg = esc((body && (body.error && (body.error.message || body.error.code))) || resp.error || ('http_' + statusCode) || 'openai_embeddings_failed').slice(0, 500);
  if (ids.length) {
    failSql = "UPDATE document_chunks SET embedding_attempts = embedding_attempts + 1, embedding_last_error = '" + errMsg + "', embedding_status = CASE WHEN embedding_attempts + 1 >= " + maxRetries + " THEN 'FAILED' ELSE 'PENDING' END, embedding_next_retry_at = now() + ((POWER(2, LEAST(embedding_attempts + 1, 6))::int || ' minutes')::interval), embedding_updated_at = now(), embedding_vector = NULL WHERE id IN (" + ids.map((id) => "'" + esc(id) + "'::uuid").join(',') + ") RETURNING id, embedding_status";
  }
}
return [{ json: { requestId: cls.requestId, userId: cls.userId, sessionId: cls.sessionId, startedAtMs: cls.startedAtMs, total: cls.total, skippedValid: cls.skippedValid, skippedEmpty: cls.skippedEmpty, generated, failed, persistSql, failSql, okHttp, statusCode } }];`,

  finWork: `const p = $('Processar resposta').first().json || {};
return [{ json: { ok: Number(p.failed || 0) === 0, requestId: p.requestId || '', total: Number(p.total || 0), skippedValid: Number(p.skippedValid || 0), skippedEmpty: Number(p.skippedEmpty || 0), generated: Number(p.generated || 0), failed: Number(p.failed || 0), pending: Number(p.failed || 0), durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())), statusCode: p.statusCode || null } }];`,

  finNoWork: `const cls = $('Classificar chunks').first().json || {};
return [{ json: { ok: true, requestId: cls.requestId || '', total: Number(cls.total || 0), skippedValid: Number(cls.skippedValid || 0), skippedEmpty: Number(cls.skippedEmpty || 0), generated: 0, failed: 0, pending: 0, durationMs: Math.max(0, Date.now() - Number(cls.startedAtMs || Date.now())) } }];`,

  finEmpty: `const n = $('Normalizar entrada').first().json || {};
return [{ json: { ok: true, requestId: n.requestId || '', total: 0, skippedValid: 0, skippedEmpty: 0, generated: 0, failed: 0, pending: 0, durationMs: Math.max(0, Date.now() - Number(n.startedAtMs || Date.now())) } }];`,
};

const secretsQuery =
  "SELECT\n" +
  "  MAX(CASE WHEN key = 'embedding_model' THEN value END) AS model,\n" +
  "  MAX(CASE WHEN key = 'embedding_dimensions' THEN value END) AS dimensions,\n" +
  "  MAX(CASE WHEN key = 'embedding_max_retries' THEN value END) AS max_retries,\n" +
  "  MAX(CASE WHEN key = 'embedding_engine_version' THEN value END) AS engine_version,\n" +
  "  MAX(CASE WHEN key = 'embedding_timeout_ms' THEN value END) AS timeout_ms\n" +
  "FROM app_secrets\n" +
  "WHERE key IN ('embedding_model','embedding_dimensions','embedding_max_retries','embedding_engine_version','embedding_timeout_ms');";

const ifParams = (leftExpr) => ({
  conditions: {
    combinator: 'and',
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [
      {
        id: 'c1',
        leftValue: leftExpr,
        rightValue: true,
        operator: { type: 'boolean', operation: 'true' },
      },
    ],
  },
  looseTypeValidation: true,
});

const ops = [
  { type: 'removeConnection', source: 'Trigger', target: 'Finalizar stub' },
  { type: 'removeNode', nodeName: 'Finalizar stub' },
  {
    type: 'addNode',
    node: {
      name: 'Normalizar entrada',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240, 100],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.normalizar },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Entrada vazia?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [480, 100],
      parameters: ifParams('={{ $json.empty === true }}'),
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Finalizar vazio',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [720, -40],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.finEmpty },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Carregar secrets',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [720, 220],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: { operation: 'executeQuery', options: {}, query: secretsQuery },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Carregar chunks',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [960, 220],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: {
        operation: 'executeQuery',
        options: {},
        query: "={{ $('Normalizar entrada').first().json.loadSql }}",
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Classificar chunks',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 220],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.classificar },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Marcar SKIPPED',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1440, 220],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: { operation: 'executeQuery', options: {}, query: '={{ $json.markSkippedSql }}' },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Tem trabalho?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [1680, 220],
      parameters: ifParams("={{ $('Classificar chunks').first().json.hasWork === true }}"),
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Finalizar sem trabalho',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1920, 380],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.finNoWork },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Marcar PROCESSING',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1920, 80],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: {
        operation: 'executeQuery',
        options: {},
        query: "={{ $('Classificar chunks').first().json.markProcessingSql }}",
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'OpenAI Embeddings',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.4,
      position: [2160, 80],
      credentials: { openAiApi: { id: 'g6QTP6n02dss9A0d', name: 'OpenAI account' } },
      parameters: {
        method: 'POST',
        url: 'https://api.openai.com/v1/embeddings',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'openAiApi',
        sendBody: true,
        contentType: 'json',
        specifyBody: 'json',
        jsonBody: "={{ $('Classificar chunks').first().json.openaiBody }}",
        options: {
          timeout: "={{ $('Classificar chunks').first().json.timeoutMs || 60000 }}",
          response: { response: { fullResponse: true, neverError: true } },
        },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Processar resposta',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2400, 80],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.processar },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Persistir VALID',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [2640, 80],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: { operation: 'executeQuery', options: {}, query: '={{ $json.persistSql }}' },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Persistir falhas',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [2880, 80],
      credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
      parameters: {
        operation: 'executeQuery',
        options: {},
        query: "={{ $('Processar resposta').first().json.failSql }}",
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Finalizar com trabalho',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3120, 80],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: js.finWork },
    },
  },
  { type: 'addConnection', source: 'Trigger', target: 'Normalizar entrada' },
  { type: 'addConnection', source: 'Normalizar entrada', target: 'Entrada vazia?' },
  { type: 'addConnection', source: 'Entrada vazia?', target: 'Finalizar vazio', sourceIndex: 0 },
  { type: 'addConnection', source: 'Entrada vazia?', target: 'Carregar secrets', sourceIndex: 1 },
  { type: 'addConnection', source: 'Carregar secrets', target: 'Carregar chunks' },
  { type: 'addConnection', source: 'Carregar chunks', target: 'Classificar chunks' },
  { type: 'addConnection', source: 'Classificar chunks', target: 'Marcar SKIPPED' },
  { type: 'addConnection', source: 'Marcar SKIPPED', target: 'Tem trabalho?' },
  { type: 'addConnection', source: 'Tem trabalho?', target: 'Marcar PROCESSING', sourceIndex: 0 },
  { type: 'addConnection', source: 'Tem trabalho?', target: 'Finalizar sem trabalho', sourceIndex: 1 },
  { type: 'addConnection', source: 'Marcar PROCESSING', target: 'OpenAI Embeddings' },
  { type: 'addConnection', source: 'OpenAI Embeddings', target: 'Processar resposta' },
  { type: 'addConnection', source: 'Processar resposta', target: 'Persistir VALID' },
  { type: 'addConnection', source: 'Persistir VALID', target: 'Persistir falhas' },
  { type: 'addConnection', source: 'Persistir falhas', target: 'Finalizar com trabalho' },
  {
    type: 'setNodeSettings',
    nodeName: 'Carregar chunks',
    settings: { alwaysOutputData: true },
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Marcar SKIPPED',
    settings: { alwaysOutputData: true },
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Marcar PROCESSING',
    settings: { alwaysOutputData: true },
  },
  {
    type: 'setNodeSettings',
    nodeName: 'OpenAI Embeddings',
    settings: { alwaysOutputData: true, onError: 'continueRegularOutput' },
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Persistir VALID',
    settings: { alwaysOutputData: true },
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Persistir falhas',
    settings: { alwaysOutputData: true },
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Carregar secrets',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Carregar chunks',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Marcar SKIPPED',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Marcar PROCESSING',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Persistir VALID',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'Persistir falhas',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeCredential',
    nodeName: 'OpenAI Embeddings',
    credentialKey: 'openAiApi',
    credentialId: 'g6QTP6n02dss9A0d',
    credentialName: 'OpenAI account',
  },
];

writeFileSync(new URL('./_ops-gerar.json', import.meta.url), JSON.stringify({ operations: ops }, null, 2));
console.log('ops', ops.length);
