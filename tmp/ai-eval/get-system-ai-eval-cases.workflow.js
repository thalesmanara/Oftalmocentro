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
  '  SELECT id, code, name, group_name, test_type, category_name, subcategory_name, expected_document_id,\n' +
  '    expected_document_ids, question, expected_answer, required_words, forbidden_words,\n' +
  '    required_source_document_id, min_score, expect_no_answer, notes, status, version,\n' +
  '    depends_on_missing_docs, created_at, updated_at\n' +
  '  FROM ai_test_cases\n' +
  '  WHERE\n' +
  '    (\n' +
  '      NULLIF(\'{{ $json.query.groupName || "" }}\', \'\') IS NULL\n' +
  '      OR group_name = NULLIF(\'{{ String($json.query.groupName || "").replace(/\'/g, "\'\'") }}\', \'\')\n' +
  '    )\n' +
  '    AND (\n' +
  '      NULLIF(\'{{ $json.query.testType || "" }}\', \'\') IS NULL\n' +
  '      OR test_type = NULLIF(\'{{ String($json.query.testType || "").replace(/\'/g, "\'\'") }}\', \'\')\n' +
  '    )\n' +
  '    AND (\n' +
  '      NULLIF(\'{{ $json.query.status || "" }}\', \'\') IS NULL\n' +
  '      OR status = NULLIF(\'{{ String($json.query.status || "").replace(/\'/g, "\'\'") }}\', \'\')\n' +
  '    )\n' +
  '),\n' +
  'counted AS (SELECT COUNT(*)::int AS total FROM filtered)\n' +
  'SELECT f.*, c.total, p.page, p.page_size,\n' +
  '  CEIL(c.total::numeric / NULLIF(p.page_size, 0))::int AS total_pages\n' +
  'FROM filtered f\n' +
  'CROSS JOIN counted c\n' +
  'CROSS JOIN params p\n' +
  'ORDER BY f.group_name ASC, f.code ASC\n' +
  'LIMIT (SELECT page_size FROM params)\n' +
  'OFFSET (SELECT (page - 1) * page_size FROM params);';

const summaryQuery =
  'SELECT group_name, COUNT(*)::int AS total,\n' +
  "  COUNT(*) FILTER (WHERE status = 'active')::int AS active,\n" +
  '  COUNT(*) FILTER (WHERE depends_on_missing_docs)::int AS depends_on_missing_docs\n' +
  'FROM ai_test_cases\n' +
  'GROUP BY group_name\n' +
  'ORDER BY group_name ASC;';

const collectJs = `const rows = $('Listar casos').all().map((i) => i.json).filter((j) => j && (j.id || j.total != null));
const summaryRows = $('Resumo por grupo').all().map((i) => i.json).filter((j) => j && j.group_name);
const norm = $('Normalizar request').first().json;
const q = norm.query || {};
let page = parseInt(q.page || '1', 10);
if (!Number.isFinite(page) || page < 1) page = 1;
let pageSize = parseInt(q.pageSize || '20', 10);
if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
if (pageSize > 200) pageSize = 200;
const total = rows.length > 0 ? Number(rows[0].total ?? 0) : 0;
const totalPages = rows.length > 0 ? Number(rows[0].total_pages ?? 0) : (total > 0 ? Math.ceil(total / pageSize) : 0);
const items = rows.filter((r) => r.id).map((r) => ({
  id: r.id,
  code: r.code,
  name: r.name,
  groupName: r.group_name,
  testType: r.test_type,
  categoryName: r.category_name,
  subcategoryName: r.subcategory_name,
  expectedDocumentId: r.expected_document_id,
  expectedDocumentIds: r.expected_document_ids || [],
  question: r.question,
  expectedAnswer: r.expected_answer,
  requiredWords: r.required_words || [],
  forbiddenWords: r.forbidden_words || [],
  requiredSourceDocumentId: r.required_source_document_id,
  minScore: r.min_score != null ? Number(r.min_score) : null,
  expectNoAnswer: !!r.expect_no_answer,
  notes: r.notes,
  status: r.status,
  version: Number(r.version || 1),
  dependsOnMissingDocs: !!r.depends_on_missing_docs,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
}));
const summaryByGroup = {};
for (const s of summaryRows) {
  summaryByGroup[s.group_name] = {
    total: Number(s.total || 0),
    active: Number(s.active || 0),
    dependsOnMissingDocs: Number(s.depends_on_missing_docs || 0),
  };
}
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: { items, pagination: { page, pageSize, total, totalPages }, summaryByGroup },
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
    parameters: { path: 'system/ai-eval/cases', responseMode: 'responseNode', options: {} },
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

const listarCasos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Listar casos',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(listQuery), options: {} },
  },
});

const resumoPorGrupo = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Resumo por grupo',
    credentials: { postgres: PG_CRED },
    executeOnce: true,
    parameters: { operation: 'executeQuery', query: expr(summaryQuery), options: {} },
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

const successPath = restaurar.to(listarCasos.to(resumoPorGrupo.to(coletar.to(prepararSucesso.to(respondOk)))));

export default workflow('get-system-ai-eval-cases', 'GET System AI Eval Cases')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
