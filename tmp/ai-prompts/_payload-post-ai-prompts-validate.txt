import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/ai-prompts/validate', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
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

const montarSqlContexto = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de contexto',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const versionId = String(body.versionId || '').trim();
const validationRunId = String(body.validationRunId || '').trim();
const sql = "SELECT\n" +
  "  v.id AS \"id\", v.prompt_definition_id AS \"promptDefinitionId\", v.version_number AS \"versionNumber\",\n" +
  "  v.status AS \"status\", v.environment AS \"environment\", v.content AS \"content\", v.model_name AS \"modelName\",\n" +
  "  v.temperature AS \"temperature\", v.max_tokens AS \"maxTokens\", v.top_p AS \"topP\", v.parameters AS \"parameters\",\n" +
  "  v.content_hash AS \"contentHash\", d.code AS \"promptCode\", d.purpose AS \"purpose\"\n" +
  "FROM ai_prompt_versions v\n" +
  "JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id\n" +
  "WHERE v.id = NULLIF('" + esc(versionId) + "','')::uuid;";
return [{ json: { sql, versionId: versionId || null, validationRunId: validationRunId || null } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', versionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886', validationRunId: null } }],
});

const carregarContexto = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar contexto',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr('={{ $json.sql }}'), options: {} },
  },
  output: [{ json: { id: '279a2ddd-9b80-4661-9a07-4cdf5066e886', status: 'DRAFT', content: 'x', modelName: 'gpt-4.1-mini', temperature: 0.1, maxTokens: 800, parameters: {} } }],
});

const avaliarContexto = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar contexto',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const ctx = $('Montar SQL de contexto').first().json || {};
const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
if (!row || !row.id) {
  return [{ json: { ok: false, httpStatus: 404, code: 'VERSION_NOT_FOUND', message: 'Versão de prompt não encontrada.' } }];
}
const content = body.content != null && String(body.content).trim() !== '' ? String(body.content) : String(row.content || '');
const modelName = body.modelName != null && String(body.modelName).trim() !== '' ? String(body.modelName) : String(row.modelName || '');
const temperature = body.temperature !== undefined && body.temperature !== null && body.temperature !== '' ? Number(body.temperature) : (row.temperature != null ? Number(row.temperature) : null);
const maxTokens = body.maxTokens !== undefined && body.maxTokens !== null && body.maxTokens !== '' ? Number(body.maxTokens) : (row.maxTokens != null ? Number(row.maxTokens) : null);
let parameters = body.parameters !== undefined ? body.parameters : row.parameters;
if (typeof parameters === 'string') { try { parameters = JSON.parse(parameters || '{}'); } catch (_) { parameters = {}; } }
parameters = parameters && typeof parameters === 'object' ? parameters : {};
const status = body.status != null ? String(body.status) : String(row.status || 'DRAFT');
return [{ json: {
  ok: true,
  id: row.id,
  promptDefinitionId: row.promptDefinitionId,
  promptCode: row.promptCode,
  purpose: row.purpose,
  versionNumber: row.versionNumber != null ? Number(row.versionNumber) : null,
  status: row.status,
  content, modelName, temperature, maxTokens, parameters, statusForValidation: status,
  contentHash: row.contentHash,
  validationRunId: ctx.validationRunId,
  requestId: norm.requestId,
} }];`,
    },
  },
  output: [{ json: { ok: true, id: '279a2ddd-9b80-4661-9a07-4cdf5066e886' } }],
});

const contextoOk = ifElse({
  version: 2.3,
  config: {
    name: 'Contexto ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'c1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const marcarValidating = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar VALIDATING',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      query: expr(
        "UPDATE ai_prompt_versions SET status = 'VALIDATING'" +
          ", validation_run_id = COALESCE(NULLIF('{{ $('Avaliar contexto').first().json.validationRunId || '' }}','')::uuid, validation_run_id)" +
          " WHERE id = '{{ $('Avaliar contexto').first().json.id }}'::uuid AND status IN ('DRAFT','VALIDATING','REJECTED')" +
          " RETURNING id AS \"id\", status AS \"status\", validation_run_id AS \"validationRunId\";"
      ),
      options: {},
    },
  },
  output: [{ json: { id: '279a2ddd-9b80-4661-9a07-4cdf5066e886', status: 'VALIDATING', validationRunId: null } }],
});

const chamarValidacao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Chamar VALIDAR',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'HT0aD7hn73HybpFT', cachedResultName: 'IA - VALIDAR CONFIGURAÇÃO DO PROMPT' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          content: "={{ $('Avaliar contexto').first().json.content }}",
          modelName: "={{ $('Avaliar contexto').first().json.modelName }}",
          temperature: "={{ $('Avaliar contexto').first().json.temperature }}",
          maxTokens: "={{ $('Avaliar contexto').first().json.maxTokens }}",
          parameters: "={{ $('Avaliar contexto').first().json.parameters }}",
          status: "={{ $('Avaliar contexto').first().json.statusForValidation }}",
        },
      },
    },
  },
  output: [{ json: { ok: true, errors: [], warnings: [] } }],
});

const finalizarStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalizar status',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const val = $input.first().json || {};
const ctx = $('Avaliar contexto').first().json || {};
const marked = $('Marcar VALIDATING').first().json || {};
const ok = !!val.ok;
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const nextStatus = ok ? 'DRAFT' : 'REJECTED';
const sql = "UPDATE ai_prompt_versions SET status = '" + nextStatus + "' WHERE id = '" + esc(ctx.id) + "'::uuid RETURNING id AS \"id\", status AS \"status\", version_number AS \"versionNumber\", model_name AS \"modelName\", content_hash AS \"contentHash\", validation_run_id AS \"validationRunId\";";
return [{ json: {
  ok,
  errors: val.errors || [],
  warnings: val.warnings || [],
  sql,
  versionId: ctx.id,
  promptDefinitionId: ctx.promptDefinitionId,
  promptCode: ctx.promptCode,
  versionNumber: ctx.versionNumber,
  modelName: ctx.modelName,
  contentHash: ctx.contentHash,
  validationRunId: marked.validationRunId || ctx.validationRunId || null,
  nextStatus,
} }];`,
    },
  },
  output: [{ json: { ok: true, sql: 'SELECT 1', errors: [], warnings: [] } }],
});

const atualizarStatusFinal = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar status final',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', query: expr('={{ $json.sql }}'), options: {} },
  },
  output: [{ json: { id: '279a2ddd-9b80-4661-9a07-4cdf5066e886', status: 'DRAFT', versionNumber: 2, modelName: 'gpt-4.1-mini', contentHash: 'h', validationRunId: null } }],
});

const montarResultado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resultado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const fin = $('Finalizar status').first().json || {};
const norm = $('Normalizar request').first().json || {};
let sessionId = '';
try { sessionId = $('Validar auth').first().json.sessionId || ''; } catch (e) {}
const version = {
  id: row.id,
  promptDefinitionId: fin.promptDefinitionId,
  promptCode: fin.promptCode,
  versionNumber: row.versionNumber != null ? Number(row.versionNumber) : fin.versionNumber,
  status: row.status,
  modelName: row.modelName || fin.modelName,
  contentHash: row.contentHash || fin.contentHash,
  validationRunId: row.validationRunId || fin.validationRunId || null,
};
return [{ json: {
  data: { ok: fin.ok, errors: fin.errors, warnings: fin.warnings, version },
  asList: false,
  statusCode: 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId: '',
  sessionId,
  auditVersionId: version.id,
  auditVersionNumber: version.versionNumber,
  auditModelName: version.modelName,
  auditContentHash: version.contentHash,
  auditPromptDefinitionId: fin.promptDefinitionId,
  auditPromptCode: fin.promptCode,
  auditOk: fin.ok,
  auditValidationRunId: version.validationRunId,
} }];`,
    },
  },
  output: [{ json: { data: { ok: true, errors: [], warnings: [] }, asList: false, statusCode: 200, requestId: '11111111-1111-1111-1111-111111111111' } }],
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

const auditarStart = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar START',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'AI_PROMPT_VALIDATION_START',
          resourceType: 'ai_prompt_version',
          resourceId: "={{ $('Montar resultado').first().json.auditVersionId || '' }}",
          success: '={{ true }}',
          requestId: '={{ $json.requestId }}',
          tracking: '={{ $json.tracking }}',
          response: '={{ $json.response }}',
          responseHeaders: '={{ $json.responseHeaders }}',
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          statusCode: '={{ $json.statusCode }}',
          durationMs: '={{ $json.durationMs }}',
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          metadata:
            "={{ { promptDefinitionId: $('Montar resultado').first().json.auditPromptDefinitionId, promptCode: $('Montar resultado').first().json.auditPromptCode, versionNumber: $('Montar resultado').first().json.auditVersionNumber, modelName: $('Montar resultado').first().json.auditModelName, contentHash: $('Montar resultado').first().json.auditContentHash, validationRunId: $('Montar resultado').first().json.auditValidationRunId } }}",
        },
      },
    },
  },
});

const auditarFinish = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar FINISH',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUDITORIA - REGISTRAR', mode: 'id', value: 'jtQvQlqRZ5X5WF9I' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          action: 'AI_PROMPT_VALIDATION_FINISH',
          resourceType: 'ai_prompt_version',
          resourceId: "={{ $('Montar resultado').first().json.auditVersionId || '' }}",
          success: "={{ $('Montar resultado').first().json.auditOk === true }}",
          requestId: '={{ $json.requestId }}',
          tracking: '={{ $json.tracking }}',
          response: '={{ $json.response }}',
          responseHeaders: '={{ $json.responseHeaders }}',
          headers: "={{ $('Normalizar request').first().json.headers || {} }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          statusCode: '={{ $json.statusCode }}',
          durationMs: '={{ $json.durationMs }}',
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          metadata:
            "={{ { promptDefinitionId: $('Montar resultado').first().json.auditPromptDefinitionId, promptCode: $('Montar resultado').first().json.auditPromptCode, versionNumber: $('Montar resultado').first().json.auditVersionNumber, modelName: $('Montar resultado').first().json.auditModelName, contentHash: $('Montar resultado').first().json.auditContentHash, validationRunId: $('Montar resultado').first().json.auditValidationRunId, ok: $('Montar resultado').first().json.auditOk } }}",
        },
      },
    },
  },
});

const repassarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Repassar resposta',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const prep = $('Preparar sucesso').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`,
    },
  },
});

const prepararErroNegocio = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro negócio',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: '={{ $json.code }}',
          message: '={{ $json.message }}',
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: '={{ $json.httpStatus }}',
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
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

const respondDynamic = node({
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

const respondErroNegocio = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond erro negócio',
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

const successPath = restaurar.to(
  montarSqlContexto.to(
    carregarContexto.to(
      avaliarContexto.to(
        contextoOk
          .onTrue(marcarValidating.to(chamarValidacao.to(finalizarStatus.to(atualizarStatusFinal.to(montarResultado.to(prepararSucesso.to(auditarStart.to(auditarFinish.to(repassarResposta.to(respondDynamic))))))))))
          .onFalse(prepararErroNegocio.to(respondErroNegocio))
      )
    )
  )
);

export default workflow('post-ai-prompts-validate', 'POST System AI Prompts Validate')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
