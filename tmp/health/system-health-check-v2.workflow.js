import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const DB_QUERY =
  "WITH t0 AS (SELECT clock_timestamp() AS started),\n" +
  "essential AS (\n" +
  "  SELECT COALESCE(array_agg(table_name ORDER BY table_name), ARRAY[]::text[]) AS present\n" +
  "  FROM information_schema.tables\n" +
  "  WHERE table_schema = 'public'\n" +
  "    AND table_name = ANY(ARRAY[\n" +
  "      'users','documents','document_chunks','categories','subcategories',\n" +
  "      'sectors','settings','user_sessions','audit_logs'\n" +
  "    ])\n" +
  "),\n" +
  "cfg AS (\n" +
  "  SELECT\n" +
  "    (SELECT COUNT(*)::int FROM settings) AS settings_count,\n" +
  "    EXISTS(\n" +
  "      SELECT 1 FROM app_secrets\n" +
  "      WHERE key = 'jwt_hs256_secret' AND COALESCE(length(value), 0) > 0\n" +
  "    ) AS jwt_ok,\n" +
  "    EXISTS(\n" +
  "      SELECT 1 FROM app_secrets\n" +
  "      WHERE key = 'session_ttl_seconds' AND COALESCE(length(value), 0) > 0\n" +
  "    ) AS ttl_ok\n" +
  "),\n" +
  "sess AS (\n" +
  "  SELECT COUNT(*)::int AS active_count\n" +
  "  FROM user_sessions\n" +
  "  WHERE COALESCE(revoked, false) = false\n" +
  "    AND expires_at > NOW()\n" +
  "),\n" +
  "doc_stats AS (\n" +
  "  SELECT\n" +
  "    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,\n" +
  "    COUNT(*) FILTER (WHERE deleted_at IS NULL AND processing_status = 'processing')::int AS processing,\n" +
  "    COUNT(*) FILTER (\n" +
  "      WHERE deleted_at IS NULL AND processing_status IN ('error', 'failed')\n" +
  "    )::int AS errors,\n" +
  "    COUNT(*) FILTER (\n" +
  "      WHERE deleted_at IS NULL AND (file_path IS NULL OR btrim(file_path) = '')\n" +
  "    )::int AS missing_files,\n" +
  "    COUNT(*) FILTER (\n" +
  "      WHERE deleted_at IS NULL\n" +
  "        AND processing_status = 'processed'\n" +
  "        AND NOT EXISTS (\n" +
  "          SELECT 1 FROM document_chunks dc WHERE dc.document_id = documents.id\n" +
  "        )\n" +
  "    )::int AS processed_without_chunks\n" +
  "  FROM documents\n" +
  "),\n" +
  "audit_probe AS (\n" +
  "  SELECT true AS ok FROM audit_logs LIMIT 1\n" +
  ")\n" +
  "SELECT\n" +
  "  1 AS ping_ok,\n" +
  "  ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - t0.started)) * 1000)::int AS duration_ms,\n" +
  "  essential.present AS tables_present,\n" +
  "  cfg.settings_count,\n" +
  "  cfg.jwt_ok,\n" +
  "  cfg.ttl_ok,\n" +
  "  sess.active_count,\n" +
  "  doc_stats.total AS documents_total,\n" +
  "  doc_stats.processing AS documents_processing,\n" +
  "  doc_stats.errors AS documents_errors,\n" +
  "  doc_stats.missing_files AS documents_missing_files,\n" +
  "  doc_stats.processed_without_chunks AS documents_processed_without_chunks,\n" +
  "  COALESCE(audit_probe.ok, true) AS audit_accessible\n" +
  "FROM t0\n" +
  "CROSS JOIN essential\n" +
  "CROSS JOIN cfg\n" +
  "CROSS JOIN sess\n" +
  "CROSS JOIN doc_stats\n" +
  "LEFT JOIN audit_probe ON true;";

const prepareChecksCode = `const dbItem = $input.first().json || {};
const dbFailed = dbItem.ping_ok == null && (dbItem.error != null || dbItem.message != null || Object.keys(dbItem).length === 0);
const required = ['users','documents','document_chunks','categories','subcategories','sectors','settings','user_sessions','audit_logs'];
let tablesPresent = dbItem.tables_present || dbItem.tablesPresent || [];
if (typeof tablesPresent === 'string') { try { tablesPresent = JSON.parse(tablesPresent); } catch { tablesPresent = []; } }
if (!Array.isArray(tablesPresent)) tablesPresent = [];
const missingTables = required.filter((t) => !tablesPresent.includes(t));
const dbDuration = Number(dbItem.duration_ms ?? dbItem.durationMs ?? 0);
const database = dbFailed ? { status: 'down', durationMs: Number.isFinite(dbDuration) ? dbDuration : 0 } : { status: missingTables.length ? 'degraded' : 'ok', durationMs: Number.isFinite(dbDuration) ? dbDuration : 0 };
const settingsOk = Number(dbItem.settings_count ?? 0) > 0;
const jwtOk = dbItem.jwt_ok === true || dbItem.jwt_ok === 'true' || dbItem.jwt_ok === 't';
const ttlOk = dbItem.ttl_ok === true || dbItem.ttl_ok === 'true' || dbItem.ttl_ok === 't';
const configuration = { status: dbFailed ? 'down' : settingsOk && jwtOk && ttlOk ? 'ok' : 'degraded', openai: 'unknown' };
const sessions = dbFailed ? { status: 'down' } : { status: 'ok', activeCount: Number(dbItem.active_count ?? 0) || 0 };
const audit = dbFailed ? { status: 'down' } : { status: 'ok' };
const documents = dbFailed ? { status: 'down' } : { status: 'ok', total: Number(dbItem.documents_total ?? 0) || 0, processing: Number(dbItem.documents_processing ?? 0) || 0, errors: Number(dbItem.documents_errors ?? 0) || 0, missingFiles: Number(dbItem.documents_missing_files ?? 0) || 0, processedWithoutChunks: Number(dbItem.documents_processed_without_chunks ?? 0) || 0 };
return [{ json: { mode: String($('Trigger').first().json.mode || 'detailed'), _partial: { n8n: { status: 'ok', durationMs: 1 }, database, configuration, sessions, audit, documents }, probePath: '/home/node/files/.health-probe.tmp', probeText: 'ok', storageStartedAtMs: Date.now() } }];`;

const finalizeStorageCode = `const prep = $('Prepare checks').first().json || {};
const readItem = $('Read probe').first() || { json: {}, binary: {} };
const readJson = readItem.json || {};
const readFailed = readJson.error != null || readJson.message != null;
let storageAvailable = false;
if (!readFailed) {
  if (readItem.binary && readItem.binary.data) storageAvailable = true;
  else if (readJson.data != null || readJson.content != null) storageAvailable = true;
}
const storageStartedAtMs = Number(prep.storageStartedAtMs || Date.now());
const durationMs = Math.max(0, Date.now() - storageStartedAtMs);
const partial = { ...(prep._partial || {}) };
partial.storage = { status: storageAvailable ? 'ok' : 'down', durationMs, storageAvailable };
return [{ json: { mode: prep.mode || 'detailed', _partial: partial, tikaStartedAtMs: Date.now() } }];`;

const aggregateHealthCode = `const prep = $('Finalize storage').first().json || {};
const partial = prep._partial || {};
const tikaItem = $input.first().json || {};
const tikaStarted = Number(prep.tikaStartedAtMs || Date.now());
const tikaDuration = Math.max(0, Date.now() - tikaStarted);
const statusCode = Number(tikaItem.statusCode ?? tikaItem.status ?? 0);
const tikaOk = Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400;
const tika = { status: tikaOk ? 'ok' : 'degraded', durationMs: tikaDuration };
const components = { n8n: partial.n8n || { status: 'ok', durationMs: 1 }, database: partial.database || { status: 'down', durationMs: 0 }, storage: { status: (partial.storage && partial.storage.status) || 'down', durationMs: (partial.storage && partial.storage.durationMs) || 0, storageAvailable: !!(partial.storage && partial.storage.storageAvailable) }, tika, configuration: { status: (partial.configuration && partial.configuration.status) || 'unknown', openai: 'unknown' }, sessions: partial.sessions || { status: 'down' }, audit: partial.audit || { status: 'down' }, documents: partial.documents || { status: 'down' } };
const essentialDown = components.n8n.status === 'down' || components.database.status === 'down' || components.storage.status === 'down';
const anyDegraded = Object.values(components).some((c) => c && c.status === 'degraded');
const anyDown = Object.values(components).some((c) => c && c.status === 'down');
let status = 'ok';
if (essentialDown) status = 'down';
else if (anyDown || anyDegraded) status = 'degraded';
const httpStatus = status === 'down' ? 503 : 200;
return [{ json: { status, checkedAt: new Date().toISOString(), components, httpStatus, mode: prep.mode || 'detailed' } }];`;

const healthTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [{ name: 'mode', type: 'string' }],
      },
    },
    output: [{ json: { mode: 'detailed' } }],
  },
});

const probeDatabase = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Probe database',
    credentials: { postgres: newCredential('Postgres account') },
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'executeQuery',
      query: DB_QUERY,
      options: {},
    },
    output: [
      {
        json: {
          ping_ok: 1,
          duration_ms: 4,
          tables_present: ['users', 'documents', 'document_chunks', 'categories', 'subcategories', 'sectors', 'settings', 'user_sessions', 'audit_logs'],
          settings_count: 1,
          jwt_ok: true,
          ttl_ok: true,
          active_count: 1,
          documents_total: 57,
          documents_processing: 0,
          documents_errors: 0,
          documents_missing_files: 0,
          documents_processed_without_chunks: 0,
          audit_accessible: true,
        },
      },
    ],
  },
});

const prepareChecks = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Prepare checks',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: prepareChecksCode,
    },
    output: [
      {
        json: {
          mode: 'detailed',
          _partial: {
            n8n: { status: 'ok', durationMs: 1 },
            database: { status: 'ok', durationMs: 4 },
            configuration: { status: 'ok', openai: 'unknown' },
            sessions: { status: 'ok', activeCount: 1 },
            audit: { status: 'ok' },
            documents: { status: 'ok', total: 57, processing: 0, errors: 0, missingFiles: 0, processedWithoutChunks: 0 },
          },
          probePath: '/home/node/files/.health-probe.tmp',
          probeText: 'ok',
          storageStartedAtMs: 0,
        },
      },
    ],
  },
});

const convertProbeToFile = node({
  type: 'n8n-nodes-base.convertToFile',
  version: 1.1,
  config: {
    name: 'Convert probe to file',
    parameters: {
      operation: 'toText',
      sourceProperty: 'probeText',
      binaryPropertyName: 'data',
      options: {
        fileName: '.health-probe.tmp',
      },
    },
    output: [
      {
        json: {
          mode: 'detailed',
          probePath: '/home/node/files/.health-probe.tmp',
          probeText: 'ok',
          storageStartedAtMs: 0,
        },
        binary: {
          data: {
            mimeType: 'text/plain',
            fileName: '.health-probe.tmp',
            data: 'b2s=',
          },
        },
      },
    ],
  },
});

const writeProbe = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: {
    name: 'Write probe',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'write',
      fileName: expr('{{ $json.probePath }}'),
      dataPropertyName: 'data',
    },
    output: [{ json: { probePath: '/home/node/files/.health-probe.tmp' } }],
  },
});

const readProbe = node({
  type: 'n8n-nodes-base.readWriteFile',
  version: 1.1,
  config: {
    name: 'Read probe',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      operation: 'read',
      fileSelector: expr("{{ $('Prepare checks').first().json.probePath }}"),
    },
    output: [
      {
        json: {},
        binary: {
          data: {
            mimeType: 'text/plain',
            fileName: '.health-probe.tmp',
            data: 'b2s=',
          },
        },
      },
    ],
  },
});

const removeProbe = node({
  type: 'n8n-nodes-base.executeCommand',
  version: 1,
  config: {
    name: 'Remove probe',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      command: 'rm -f /home/node/files/.health-probe.tmp',
    },
    output: [{ json: { stdout: '', stderr: '', exitCode: 0 } }],
  },
});

const finalizeStorage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalize storage',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: finalizeStorageCode,
    },
    output: [
      {
        json: {
          mode: 'detailed',
          _partial: {
            n8n: { status: 'ok', durationMs: 1 },
            database: { status: 'ok', durationMs: 4 },
            storage: { status: 'ok', durationMs: 5, storageAvailable: true },
            configuration: { status: 'ok', openai: 'unknown' },
            sessions: { status: 'ok', activeCount: 1 },
            audit: { status: 'ok' },
            documents: { status: 'ok', total: 57, processing: 0, errors: 0, missingFiles: 0, processedWithoutChunks: 0 },
          },
          tikaStartedAtMs: 0,
        },
      },
    ],
  },
});

const probeTika = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Probe Tika',
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: 'http://tika:9998/tika',
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Accept', value: 'text/plain' }],
      },
      options: {
        timeout: 5000,
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'text',
          },
        },
      },
    },
    output: [{ json: { statusCode: 200, body: 'ok' } }],
  },
});

const aggregateHealth = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Aggregate health',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: aggregateHealthCode,
    },
    output: [
      {
        json: {
          status: 'ok',
          checkedAt: '2026-08-01T00:00:00.000Z',
          components: {
            n8n: { status: 'ok', durationMs: 1 },
            database: { status: 'ok', durationMs: 4 },
            storage: { status: 'ok', durationMs: 5, storageAvailable: true },
            tika: { status: 'ok', durationMs: 20 },
            configuration: { status: 'ok', openai: 'unknown' },
            sessions: { status: 'ok', activeCount: 1 },
            audit: { status: 'ok' },
            documents: { status: 'ok', total: 57, processing: 0, errors: 0, missingFiles: 0, processedWithoutChunks: 0 },
          },
          httpStatus: 200,
          mode: 'detailed',
        },
      },
    ],
  },
});

export default workflow('system-health-check-v2', 'SYSTEM - HEALTH CHECK')
  .add(healthTrigger)
  .to(probeDatabase)
  .to(prepareChecks)
  .to(convertProbeToFile)
  .to(writeProbe)
  .to(readProbe)
  .to(removeProbe)
  .to(finalizeStorage)
  .to(probeTika)
  .to(aggregateHealth);
