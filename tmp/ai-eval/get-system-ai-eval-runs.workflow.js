import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const listQuery =
  'WITH params AS (\n' +
  '  SELECT GREATEST(1, COALESCE(NULLIF(\'{{ $json.query.page || "" }}\', \'\')::int, 1)) AS page,\n' +
  '    LEAST(200, GREATEST(1, COALESCE(NULLIF(\'{{ $json.query.pageSize || "" }}\', \'\')::int, 20))) AS page_size\n' +
  '),\n' +
  'filtered AS (\n' +
  '  SELECT id, started_at, finished_at, duration_ms, status, triggered_by, trigger_mode, total_cases,\n' +
  '    passed_count, failed_count, error_count, skipped_count, overall_score, prompt_version, model_name,\n' +
  '    ocr_engine_version, tabular_engine_version, report, metadata, created_at\n' +
  '  FROM ai_test_runs\n' +
  '  WHERE\n' +
  '    (\n' +
  '      NULLIF(\'{{ $json.query.status || "" }}\', \'\') IS NULL\n' +
  '      OR status = NULLIF(\'{{ String($json.query.status || "").replace(/\'/g, "\'\'") }}\', \'\')\n' +
  '    )\n' +
  '    AND (\n' +
  '      NULLIF(\'{{ $json.query.triggerMode || "" }}\', \'\') IS NULL\n' +
  '      OR trigger_mode = NULLIF(\'{{ String($json.query.triggerMode || "").replace(/\'/g, "\'\'") }}\', \'\')\n' +
  '    )\n' +
  '),\n' +
  'counted AS (SELECT COUNT(*)::int AS total FROM filtered)\n' +
  'SELECT f.*, c.total, p.page, p.page_size,\n' +
  '  CEIL(c.total::numeric / NULLIF(p.page_size, 0))::int AS total_pages\n' +
  'FROM filtered f\n' +
  'CROSS JOIN counted c\n' +
  'CROSS JOIN params p\n' +
  'ORDER BY f.started_at DESC\n' +
  'LIMIT (SELECT page_size FROM params)\n' +
  'OFFSET (SELECT (page - 1) * page_size FROM params);';

const collectJs = `const rows = $input.all().map((i) => i.json).filter((j) => j && (j.id || j.total != null));
const norm = $('Normalizar request').first().json;
const q = norm.query || {};
let page = parseInt(q.page || '1', 10);
if (!Number.isFinite(page) || page < 1) page = 1;
let pageSize = parseInt(q.pageSize || '20', 10);
if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
if (pageSize > 200) pageSize = 200;
const total = rows.length > 0 ? Number(rows[0].total ?? 0) : 0;
const totalPages = rows.length > 0 ? Number(rows[0].total_pages ?? 0) : (total > 0 ? Math.ceil(total / pageSize) : 0);
function camelRun(r) {
  return {
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    status: r.status,
    triggeredBy: r.triggered_by,
    triggerMode: r.trigger_mode,
    totalCases: Number(r.total_cases || 0),
    passedCount: Number(r.passed_count || 0),
    failedCount: Number(r.failed_count || 0),
    errorCount: Number(r.error_count || 0),
    skippedCount: Number(r.skipped_count || 0),
    overallScore: r.overall_score != null ? Number(r.overall_score) : null,
    promptVersion: r.prompt_version || null,
    modelName: r.model_name || null,
    ocrEngineVersion: r.ocr_engine_version || null,
    tabularEngineVersion: r.tabular_engine_version || null,
    report: r.report || {},
    metadata: r.metadata || {},
    createdAt: r.created_at,
  };
}
const items = rows.filter((r) => r.id).map(camelRun);
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: { items, pagination: { page, pageSize, total, totalPages } },
  asList: false,
  statusCode: 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
} }];`;

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/ai-eval/runs', responseMode: 'responseNode', options: {} },
  },
});

const normalizar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - NORMALIZAR REQUEST', mode: 'id', value: 'N3zLpj7Dij4n5p5p' },
    },
  },
});

const validarAuth = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar auth',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'P5E43ZXSJiI9wFYD', cachedResultName: 'AUTH - VALIDAR TOKEN' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          authorization: "={{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}",
          requestId: "={{ $json.requestId || '' }}",
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'a1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const validarPerm = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUTH - VALIDAR PERMISSÃO', mode: 'id', value: 'yXW3rW8EbHXuprRJ' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          isMaster: '={{ $json.user ? $json.user.isMaster === true : false }}',
          permissions: '={{ $json.permissions || ($json.user && $json.user.permissions) || [] }}',
          requiredAnyOf: '={{ [] }}',
          requiredPermission: 'editar_configuracoes',
          sessionId: "={{ $json.sessionId || '' }}",
          user: '={{ $json.user || null }}',
          userId: "={{ $json.userId || ($json.user && $json.user.id) || '' }}",
          requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}",
        },
      },
    },
  },
});

const permOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        conditions: [{ id: 'p1', leftValue: '={{ $json.ok }}', operator: { operation: 'true', type: 'boolean' }, rightValue: true }],
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      },
      looseTypeValidation: true,
    },
  },
});

const restaurar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: restoreJs },
  },
});

const listarRuns = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Listar runs',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(listQuery), options: {} },
  },
});

const coletar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Coletar lista',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: collectJs },
  },
});

const prepararSucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR SUCESSO', mode: 'id', value: 'zE5LRjZfbXw8Ymll' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          asList: '={{ $json.asList }}',
          data: '={{ $json.data }}',
          requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId }}",
          statusCode: '={{ $json.statusCode }}',
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
        },
      },
    },
  },
});

const preparar401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: "={{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}",
          message: "={{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: 401,
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
        },
      },
    },
  },
});

const preparar403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: "={{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}",
          message: "={{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: 403,
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
        },
      },
    },
  },
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: '={{ $json.statusCode }}', responseHeaders: respondHeaders },
    },
  },
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 401, responseHeaders: respondHeaders },
    },
  },
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 403, responseHeaders: respondHeaders },
    },
  },
});

const successPath = restaurar.to(listarRuns.to(coletar.to(prepararSucesso.to(respondOk))));

export default workflow('get-system-ai-eval-runs', 'GET System AI Eval Runs')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
