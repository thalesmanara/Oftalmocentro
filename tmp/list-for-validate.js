import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const listQuery = `WITH params AS (
  SELECT
    GREATEST(1, COALESCE(NULLIF('{{ $json.query.page || "" }}', '')::int, 1)) AS page,
    LEAST(100, GREATEST(1, COALESCE(NULLIF('{{ $json.query.pageSize || "" }}', '')::int, 20))) AS page_size
),
filtered AS (
  SELECT
    a.id,
    a.occurred_at,
    a.user_id,
    u.name AS user_name,
    a.action,
    a.resource_type,
    a.resource_id,
    a.success,
    a.request_id,
    a.method,
    a.path,
    a.status_code,
    a.duration_ms,
    a.ip_address::text AS ip_address,
    a.error_code,
    a.created_at
  FROM audit_logs a
  LEFT JOIN users u ON u.id = a.user_id
  WHERE
    (
      NULLIF('{{ $json.query.userId || "" }}', '') IS NULL
      OR a.user_id = NULLIF('{{ $json.query.userId || "" }}', '')::uuid
    )
    AND (
      NULLIF('{{ $json.query.action || "" }}', '') IS NULL
      OR UPPER(a.action) = UPPER(NULLIF('{{ String($json.query.action || "").replace(/'/g, "''") }}', ''))
    )
    AND (
      NULLIF('{{ $json.query.resourceType || "" }}', '') IS NULL
      OR LOWER(a.resource_type) = LOWER(NULLIF('{{ String($json.query.resourceType || "").replace(/'/g, "''") }}', ''))
    )
    AND (
      NULLIF('{{ $json.query.resourceId || "" }}', '') IS NULL
      OR a.resource_id = NULLIF('{{ $json.query.resourceId || "" }}', '')::uuid
    )
    AND (
      NULLIF('{{ $json.query.success || "" }}', '') IS NULL
      OR a.success = (NULLIF('{{ $json.query.success || "" }}', '')::boolean)
    )
    AND (
      NULLIF('{{ $json.query.requestId || "" }}', '') IS NULL
      OR a.request_id = NULLIF('{{ $json.query.requestId || "" }}', '')::uuid
    )
    AND (
      NULLIF('{{ $json.query.errorCode || "" }}', '') IS NULL
      OR a.error_code = NULLIF('{{ String($json.query.errorCode || "").replace(/'/g, "''") }}', '')
    )
    AND (
      NULLIF('{{ $json.query.dateFrom || "" }}', '') IS NULL
      OR a.occurred_at >= NULLIF('{{ $json.query.dateFrom || "" }}', '')::timestamptz
    )
    AND (
      NULLIF('{{ $json.query.dateTo || "" }}', '') IS NULL
      OR a.occurred_at <= NULLIF('{{ $json.query.dateTo || "" }}', '')::timestamptz
    )
    AND (
      NULLIF('{{ $json.query.search || "" }}', '') IS NULL
      OR a.action ILIKE '%' || NULLIF('{{ String($json.query.search || "").replace(/'/g, "''") }}', '') || '%'
      OR a.resource_type ILIKE '%' || NULLIF('{{ String($json.query.search || "").replace(/'/g, "''") }}', '') || '%'
      OR COALESCE(a.error_code, '') ILIKE '%' || NULLIF('{{ String($json.query.search || "").replace(/'/g, "''") }}', '') || '%'
    )
),
counted AS (
  SELECT COUNT(*)::int AS total FROM filtered
)
SELECT
  f.id,
  f.occurred_at,
  f.user_id,
  f.user_name,
  f.action,
  f.resource_type,
  f.resource_id,
  f.success,
  f.request_id,
  f.method,
  f.path,
  f.status_code,
  f.duration_ms,
  f.ip_address,
  f.error_code,
  f.created_at,
  c.total,
  p.page,
  p.page_size,
  CEIL(c.total::numeric / NULLIF(p.page_size, 0))::int AS total_pages
FROM filtered f
CROSS JOIN counted c
CROSS JOIN params p
ORDER BY f.occurred_at DESC
LIMIT (SELECT page_size FROM params)
OFFSET (SELECT (page - 1) * page_size FROM params);`;

const collectJs = `const rows = $input.all().map((i) => i.json).filter((j) => j && (j.id || j.total != null));
const norm = $('Normalizar request').first().json;
const q = norm.query || {};
let page = parseInt(q.page || '1', 10);
if (!Number.isFinite(page) || page < 1) page = 1;
let pageSize = parseInt(q.pageSize || '20', 10);
if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
if (pageSize > 100) pageSize = 100;
const total = rows.length > 0 ? Number(rows[0].total ?? 0) : 0;
const totalPages = rows.length > 0 ? Number(rows[0].total_pages ?? 0) : (total > 0 ? Math.ceil(total / pageSize) : 0);
const items = rows.filter((r) => r.id).map((r) => ({
  id: r.id,
  occurredAt: r.occurred_at,
  userId: r.user_id,
  userName: r.user_name,
  action: r.action,
  resourceType: r.resource_type,
  resourceId: r.resource_id,
  success: r.success,
  requestId: r.request_id,
  method: r.method,
  path: r.path,
  statusCode: r.status_code,
  durationMs: r.duration_ms,
  ipAddress: r.ip_address,
  errorCode: r.error_code,
  createdAt: r.created_at,
}));
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

const restoreJs = "return [$('Normalizar request').first()];";

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'audit', responseMode: 'responseNode', options: {} },
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
          requiredPermission: 'visualizar_auditoria',
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

const query = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Listar audit_logs',
    credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
    parameters: { operation: 'executeQuery', query: listQuery, options: {} },
    settings: { alwaysOutputData: true },
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

const successPath = restaurar.to(query.to(coletar.to(prepararSucesso.to(respondOk))));

export default workflow('get-audit', 'GET Auditoria')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
