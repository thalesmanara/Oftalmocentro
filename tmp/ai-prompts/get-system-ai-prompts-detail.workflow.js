import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const defQuery =
  'SELECT d.id AS "id", d.code AS "code", d.name AS "name", d.purpose AS "purpose", d.description AS "description",\n' +
  '  d.active AS "active", d.created_at AS "createdAt", d.updated_at AS "updatedAt"\n' +
  'FROM ai_prompt_definitions d\n' +
  'WHERE d.id = COALESCE(\n' +
  '  NULLIF(\'{{ String($json.query.id || "").replace(/\'/g, "\'\'") }}\', \'\')::uuid,\n' +
  '  (SELECT prompt_definition_id FROM ai_prompt_versions WHERE id = NULLIF(\'{{ String($json.query.versionId || "").replace(/\'/g, "\'\'") }}\', \'\')::uuid)\n' +
  ')\n' +
  'LIMIT 1;';

const versionsQuery =
  'SELECT v.id AS "id", v.version_number AS "versionNumber", v.status AS "status", v.environment AS "environment",\n' +
  '  v.content AS "content", v.model_name AS "modelName", v.temperature AS "temperature", v.max_tokens AS "maxTokens",\n' +
  '  v.top_p AS "topP", v.parameters AS "parameters", v.content_hash AS "contentHash", v.change_summary AS "changeSummary",\n' +
  '  v.created_by AS "createdBy", v.published_by AS "publishedBy", v.published_at AS "publishedAt", v.archived_at AS "archivedAt",\n' +
  '  v.based_on_version_id AS "basedOnVersionId", v.validation_run_id AS "validationRunId", v.validation_score AS "validationScore",\n' +
  '  v.metadata AS "metadata", v.created_at AS "createdAt"\n' +
  'FROM ai_prompt_versions v\n' +
  "WHERE v.prompt_definition_id = '{{ $('Carregar definição').first().json.id || '00000000-0000-0000-0000-000000000000' }}'::uuid\n" +
  'ORDER BY v.version_number DESC;';

const collectJs = `const norm = $('Normalizar request').first().json;
const defRows = $('Carregar definição').all().map((i) => i.json).filter((j) => j && j.id);
const versionRows = $('Carregar versões').all().map((i) => i.json).filter((j) => j && j.id);
const def = defRows[0] || null;
function camelVersion(v) {
  return {
    id: v.id,
    versionNumber: v.versionNumber != null ? Number(v.versionNumber) : null,
    status: v.status,
    environment: v.environment,
    content: v.content,
    modelName: v.modelName,
    temperature: v.temperature != null ? Number(v.temperature) : null,
    maxTokens: v.maxTokens != null ? Number(v.maxTokens) : null,
    topP: v.topP != null ? Number(v.topP) : null,
    parameters: v.parameters && typeof v.parameters === 'object' ? v.parameters : {},
    contentHash: v.contentHash,
    changeSummary: v.changeSummary || null,
    createdBy: v.createdBy || null,
    publishedBy: v.publishedBy || null,
    publishedAt: v.publishedAt || null,
    archivedAt: v.archivedAt || null,
    basedOnVersionId: v.basedOnVersionId || null,
    validationRunId: v.validationRunId || null,
    validationScore: v.validationScore != null ? Number(v.validationScore) : null,
    metadata: v.metadata && typeof v.metadata === 'object' ? v.metadata : {},
    createdAt: v.createdAt,
  };
}
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
if (!def) {
  return [{ json: {
    data: { error: 'PROMPT_DEFINITION_NOT_FOUND' },
    asList: false,
    statusCode: 404,
    requestId: norm.requestId,
    requestStartedAtMs: norm.requestStartedAtMs,
    method: norm.method,
    path: norm.path,
    userId,
    sessionId,
  } }];
}
const definition = {
  id: def.id,
  code: def.code,
  name: def.name,
  purpose: def.purpose,
  description: def.description || null,
  active: !!def.active,
  createdAt: def.createdAt,
  updatedAt: def.updatedAt,
};
const versions = versionRows.map(camelVersion);
return [{ json: {
  data: { definition, versions },
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
    parameters: { path: 'system/ai-prompts/detail', httpMethod: 'GET', responseMode: 'responseNode', options: {} },
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

const carregarDefinicao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar definição',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(defQuery), options: {} },
  },
});

const carregarVersoes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar versões',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(versionsQuery), options: {} },
  },
});

const coletar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Coletar detalhe',
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

const successPath = restaurar.to(carregarDefinicao.to(carregarVersoes.to(coletar.to(prepararSucesso.to(respondOk)))));

export default workflow('get-system-ai-prompts-detail', 'GET System AI Prompts Detail')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
