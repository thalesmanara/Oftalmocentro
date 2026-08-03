import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const pgCred = newCredential('Postgres account');

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'versionId', type: 'string' },
          { name: 'documentId', type: 'string' },
          { name: 'chunkIdsJson', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
          { name: 'force', type: 'boolean' },
          { name: 'limit', type: 'number' },
        ],
      },
    },
    output: [{ json: { versionId: '', documentId: '', chunkIdsJson: '[]', requestId: 'r1', force: false, limit: 32 } }],
  },
});

const prep = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const crypto = require('crypto');\n" +
        'const t = $input.first().json || {};\n' +
        "const versionId = String(t.versionId || '').trim();\n" +
        "const documentId = String(t.documentId || '').trim();\n" +
        "const requestId = String(t.requestId || '').trim() || crypto.randomUUID();\n" +
        "const userId = String(t.userId || '').trim();\n" +
        "const sessionId = String(t.sessionId || '').trim();\n" +
        "const force = t.force === true || t.force === 'true';\n" +
        'let chunkIds = [];\n' +
        "try { chunkIds = JSON.parse(String(t.chunkIdsJson || '[]')); } catch (_) { chunkIds = []; }\n" +
        'if (!Array.isArray(chunkIds)) chunkIds = [];\n' +
        'const limit = Math.min(Math.max(Number(t.limit || 32) || 32, 1), 128);\n' +
        'const startedAtMs = Date.now();\n' +
        "function esc(s){ return String(s ?? '').replace(/'/g, \"''\"); }\n" +
        "let where = \"dc.embedding_status = 'VALID' AND dc.embedding_vector IS NOT NULL\";\n" +
        "if (!force) where += \" AND (dc.embedding_sync_status IS NULL OR dc.embedding_sync_status IN ('PENDING','FAILED','INVALID') OR dc.qdrant_point_id IS NULL OR dc.embedding_hash IS DISTINCT FROM dc.content_hash)\";\n" +
        "if (versionId) where += \" AND dc.document_version_id = '\" + esc(versionId) + \"'::uuid\";\n" +
        "if (documentId) where += \" AND dc.document_id = '\" + esc(documentId) + \"'::uuid\";\n" +
        "if (chunkIds.length) where += \" AND dc.id IN (\" + chunkIds.map(id => \"'\" + esc(id) + \"'::uuid\").join(',') + \")\";\n" +
        'const loadSql = "SELECT dc.id, dc.document_id, dc.document_version_id, dc.chunk_index, dc.chunk_order, dc.chunk_kind, dc.sheet_name, dc.content_hash, dc.embedding_hash, dc.embedding_model, dc.embedding_vector, d.sector_id, d.category_id, d.subcategory_id, COALESCE(dv.title_snapshot, d.title) AS document_title, dv.is_current, dv.ocr_quality_grade FROM document_chunks dc JOIN documents d ON d.id = dc.document_id JOIN document_versions dv ON dv.id = dc.document_version_id WHERE " + where + " ORDER BY dc.chunk_order NULLS LAST, dc.chunk_index NULLS LAST LIMIT " + limit;\n' +
        'return [{ json: { versionId, documentId, requestId, userId, sessionId, force, limit, startedAtMs, loadSql } }];',
    },
    output: [{ json: { loadSql: 'SELECT 1', requestId: 'r1', startedAtMs: 1 } }],
  },
});

const cfg = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar config',
    credentials: { postgres: pgCred },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query:
        "SELECT MAX(CASE WHEN key='qdrant_url' THEN value END) AS url, MAX(CASE WHEN key='qdrant_collection' THEN value END) AS collection, MAX(CASE WHEN key='embedding_dimensions' THEN value END) AS dimensions, MAX(CASE WHEN key='qdrant_timeout_ms' THEN value END) AS timeout_ms FROM app_secrets WHERE key IN ('qdrant_url','qdrant_collection','embedding_dimensions','qdrant_timeout_ms');",
    },
    output: [{ json: { url: 'http://qdrant:6333', collection: 'oftalmocentro_chunks', dimensions: '1536', timeout_ms: '30000' } }],
  },
});

const load = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar chunks',
    credentials: { postgres: pgCred },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr("{{ $('Preparar').first().json.loadSql }}"),
    },
    output: [{ json: { id: '11111111-1111-1111-1111-111111111111' } }],
  },
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar pontos',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const prep = $('Preparar').first().json || {};\n" +
        "const cfg = $('Carregar config').first().json || {};\n" +
        'const rows = $input.all().map(i => i.json).filter(r => r && r.id);\n' +
        "const url = String(cfg.url || 'http://qdrant:6333').replace(/\\/$/, '');\n" +
        "const collection = String(cfg.collection || 'oftalmocentro_chunks');\n" +
        'const timeoutMs = Number(cfg.timeout_ms || 30000) || 30000;\n' +
        'const points = [];\n' +
        'for (const r of rows) {\n' +
        '  let vec = r.embedding_vector;\n' +
        '  if (typeof vec === \"string\") { try { vec = JSON.parse(vec); } catch (_) { vec = null; } }\n' +
        '  if (!Array.isArray(vec) || !vec.length) continue;\n' +
        '  points.push({\n' +
        '    id: String(r.id),\n' +
        '    vector: vec,\n' +
        '    payload: {\n' +
        '      chunkId: String(r.id),\n' +
        "      documentId: String(r.document_id || ''),\n" +
        "      documentVersionId: String(r.document_version_id || ''),\n" +
        '      sectorId: r.sector_id || null,\n' +
        '      categoryId: r.category_id || null,\n' +
        '      subcategoryId: r.subcategory_id || null,\n' +
        '      documentTitle: r.document_title || null,\n' +
        '      chunkIndex: r.chunk_index != null ? Number(r.chunk_index) : (r.chunk_order != null ? Number(r.chunk_order) : null),\n' +
        '      embeddingHash: r.embedding_hash || r.content_hash || null,\n' +
        '      embeddingModel: r.embedding_model || null,\n' +
        '      ocrQuality: r.ocr_quality_grade || null,\n' +
        '      chunkKind: r.chunk_kind || null,\n' +
        '      sheetName: r.sheet_name || null,\n' +
        '      pageNumber: null,\n' +
        '      isCurrent: r.is_current === true,\n' +
        '    },\n' +
        '  });\n' +
        '}\n' +
        "const upsertUrl = url + '/collections/' + encodeURIComponent(collection) + '/points?wait=true';\n" +
        'return [{ json: { requestId: prep.requestId, userId: prep.userId, sessionId: prep.sessionId, versionId: prep.versionId, documentId: prep.documentId, startedAtMs: prep.startedAtMs, collection, url: upsertUrl, timeoutMs, count: points.length, pointIds: points.map(p => p.id), body: { points }, skip: points.length === 0 } }];',
    },
    output: [{ json: { skip: true, count: 0, pointIds: [], body: { points: [] }, url: 'http://qdrant:6333/collections/x/points?wait=true' } }],
  },
});

const needUpsert = ifElse({
  version: 2.2,
  config: {
    name: 'Tem pontos?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          {
            id: 'c1',
            leftValue: expr('{{ $json.count }}'),
            rightValue: 0,
            operator: { type: 'number', operation: 'gt' },
          },
        ],
      },
    },
  },
});

const httpUpsert = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Qdrant upsert',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PUT',
      url: expr('{{ $json.url }}'),
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ $json.body }}'),
      options: {
        timeout: 30000,
        response: { response: { fullResponse: true, neverError: true } },
      },
    },
    output: [{ json: { statusCode: 200, body: { status: 'ok' } } }],
  },
});

const persist = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Persistir resultado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const built = $('Montar pontos').first().json || {};\n" +
        'const resp = $input.first().json || {};\n' +
        'const statusCode = Number(resp.statusCode ?? resp.status ?? 0);\n' +
        'let body = resp.body ?? resp.data ?? resp;\n' +
        "if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }\n" +
        "const okHttp = statusCode >= 200 && statusCode < 300 && String(body.status || 'ok').toLowerCase() !== 'error';\n" +
        'const ids = built.pointIds || [];\n' +
        'const syncMs = Math.max(0, Date.now() - Number(built.startedAtMs || Date.now()));\n' +
        "function esc(s){ return String(s ?? '').replace(/'/g, \"''\"); }\n" +
        "let sql = 'SELECT 0 AS noop WHERE false';\n" +
        'if (!ids.length) {\n' +
        "  return [{ json: { ok: true, synced: 0, failed: 0, skipped: true, requestId: built.requestId, collection: built.collection, syncMs, sql, auditAction: 'QDRANT_UPSERT' } }];\n" +
        '}\n' +
        'if (okHttp) {\n' +
        "  sql = \"UPDATE document_chunks SET qdrant_point_id = id::text, embedding_sync_status = 'SYNCED', embedding_synced_at = now(), embedding_sync_error = NULL, embedding_sync_ms = \" + syncMs + \", embedding_hash = COALESCE(embedding_hash, content_hash) WHERE id IN (\" + ids.map(id => \"'\" + esc(id) + \"'::uuid\").join(',') + \") RETURNING id\";\n" +
        "  return [{ json: { ok: true, synced: ids.length, failed: 0, skipped: false, requestId: built.requestId, userId: built.userId, sessionId: built.sessionId, collection: built.collection, syncMs, sql, auditAction: 'QDRANT_UPSERT' } }];\n" +
        '}\n' +
        "const err = esc((body && body.status && body.status.error) || body.message || ('http_' + statusCode) || 'qdrant_upsert_failed').slice(0, 500);\n" +
        "sql = \"UPDATE document_chunks SET embedding_sync_status = 'FAILED', embedding_sync_error = '\" + err + \"', embedding_sync_attempts = COALESCE(embedding_sync_attempts,0) + 1, embedding_sync_ms = \" + syncMs + \" WHERE id IN (\" + ids.map(id => \"'\" + esc(id) + \"'::uuid\").join(',') + \") RETURNING id\";\n" +
        "return [{ json: { ok: false, synced: 0, failed: ids.length, skipped: false, requestId: built.requestId, userId: built.userId, sessionId: built.sessionId, collection: built.collection, syncMs, sql, error: err, auditAction: 'QDRANT_SYNC_FAILED' } }];",
    },
    output: [{ json: { ok: true, synced: 0, sql: 'SELECT 1', auditAction: 'QDRANT_UPSERT', requestId: 'r1' } }],
  },
});

const runSql = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar PG',
    credentials: { postgres: pgCred },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr('{{ $json.sql }}'),
    },
    output: [{ json: { id: '1' } }],
  },
});

const audit = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria',
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: expr("{{ $('Persistir resultado').first().json.auditAction }}"),
          entityType: 'qdrant',
          entityId: expr("{{ $('Persistir resultado').first().json.collection || 'oftalmocentro_chunks' }}"),
          userId: expr("{{ $('Persistir resultado').first().json.userId || '' }}"),
          sessionId: expr("{{ $('Persistir resultado').first().json.sessionId || '' }}"),
          requestId: expr("{{ $('Persistir resultado').first().json.requestId || '' }}"),
          metadata: expr("{{ JSON.stringify({ synced: $('Persistir resultado').first().json.synced, failed: $('Persistir resultado').first().json.failed, syncMs: $('Persistir resultado').first().json.syncMs, ok: $('Persistir resultado').first().json.ok }) }}"),
        },
      },
      options: { waitForSubWorkflow: true },
    },
    output: [{ json: { ok: true } }],
  },
});

const finOk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Retorno',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const p = $('Persistir resultado').first().json || {};\n" +
        'return [{ json: { ok: p.ok === true, synced: p.synced || 0, failed: p.failed || 0, skipped: !!p.skipped, collection: p.collection, syncMs: p.syncMs, requestId: p.requestId, error: p.error || null } }];',
    },
    output: [{ json: { ok: true, synced: 0 } }],
  },
});

const idle = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Idle',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        "const b = $('Montar pontos').first().json || {};\n" +
        'return [{ json: { ok: true, synced: 0, failed: 0, skipped: true, collection: b.collection, syncMs: 0, requestId: b.requestId } }];',
    },
    output: [{ json: { ok: true, skipped: true } }],
  },
});

export default workflow('qdrant-upsert', 'QDRANT - UPSERT')
  .add(trig)
  .to(prep)
  .to(cfg)
  .to(load)
  .to(build)
  .to(needUpsert.onTrue(httpUpsert.to(persist).to(runSql).to(audit).to(finOk)).onFalse(idle));
