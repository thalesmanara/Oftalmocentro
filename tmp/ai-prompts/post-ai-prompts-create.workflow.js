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
    parameters: { path: 'system/ai-prompts/create', httpMethod: 'POST', responseMode: 'responseNode', options: {} },
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
const promptDefinitionId = String(body.promptDefinitionId || '').trim();
const code = String(body.code || '').trim();
const basedOnVersionId = String(body.basedOnVersionId || '').trim();
const sql = "WITH def AS (\\n" +
  "  SELECT d.id, d.code, d.purpose FROM ai_prompt_definitions d\\n" +
  "  WHERE (\\n" +
  "    ('" + esc(promptDefinitionId) + "' <> '' AND d.id = '" + esc(promptDefinitionId) + "'::uuid)\\n" +
  "    OR ('" + esc(promptDefinitionId) + "' = '' AND '" + esc(code) + "' <> '' AND d.code = '" + esc(code) + "')\\n" +
  "  )\\n" +
  "  LIMIT 1\\n" +
  "),\\n" +
  "based AS (\\n" +
  "  SELECT v.* FROM ai_prompt_versions v WHERE v.id = NULLIF('" + esc(basedOnVersionId) + "','')::uuid AND v.prompt_definition_id = (SELECT id FROM def)\\n" +
  "),\\n" +
  "maxv AS (\\n" +
  "  SELECT COALESCE(MAX(version_number),0) AS max_version FROM ai_prompt_versions WHERE prompt_definition_id = (SELECT id FROM def)\\n" +
  ")\\n" +
  "SELECT\\n" +
  "  (SELECT id FROM def) AS \\"promptDefinitionId\\",\\n" +
  "  (SELECT code FROM def) AS \\"promptCode\\",\\n" +
  "  (SELECT purpose FROM def) AS \\"purpose\\",\\n" +
  "  (SELECT max_version FROM maxv) AS \\"maxVersion\\",\\n" +
  "  b.content AS \\"basedContent\\", b.model_name AS \\"basedModelName\\", b.temperature AS \\"basedTemperature\\",\\n" +
  "  b.max_tokens AS \\"basedMaxTokens\\", b.top_p AS \\"basedTopP\\", b.parameters AS \\"basedParameters\\", b.environment AS \\"basedEnvironment\\"\\n" +
  "FROM (SELECT 1) x\\n" +
  "LEFT JOIN based b ON true;";
return [{ json: { sql, basedOnVersionId: basedOnVersionId || null } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', basedOnVersionId: null } }],
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
  output: [{ json: { promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d', promptCode: 'AI_QUERY_MAIN', purpose: 'AI_QUERY_MAIN', maxVersion: 2, basedContent: null, basedModelName: null, basedTemperature: null, basedMaxTokens: null, basedTopP: null, basedParameters: null, basedEnvironment: null } }],
});

const avaliarCriacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar criação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const norm = $('Normalizar request').first().json || {};
const body = norm.body || {};
let userId = '';
try { userId = $('Validar auth').first().json.userId || ''; } catch (e) {}
const promptDefinitionId = row.promptDefinitionId || null;
if (!promptDefinitionId) {
  return [{ json: { ok: false, httpStatus: 404, code: 'PROMPT_DEFINITION_NOT_FOUND', message: 'Definição de prompt não encontrada.' } }];
}
function numOrNull(v) { return v === undefined || v === null || v === '' ? null : Number(v); }
const content = (body.content !== undefined && body.content !== null && String(body.content).trim() !== '') ? String(body.content) : (row.basedContent != null ? String(row.basedContent) : '');
const modelName = (body.modelName !== undefined && body.modelName !== null && String(body.modelName).trim() !== '') ? String(body.modelName) : String(row.basedModelName || '');
const temperature = (body.temperature !== undefined && body.temperature !== null && body.temperature !== '') ? Number(body.temperature) : numOrNull(row.basedTemperature);
const maxTokens = (body.maxTokens !== undefined && body.maxTokens !== null && body.maxTokens !== '') ? Number(body.maxTokens) : numOrNull(row.basedMaxTokens);
const topP = (body.topP !== undefined && body.topP !== null && body.topP !== '') ? Number(body.topP) : numOrNull(row.basedTopP);
let parameters = body.parameters !== undefined ? body.parameters : row.basedParameters;
if (typeof parameters === 'string') { try { parameters = JSON.parse(parameters || '{}'); } catch (_) { parameters = {}; } }
parameters = parameters && typeof parameters === 'object' && !Array.isArray(parameters) ? parameters : {};
const environment = String(body.environment || row.basedEnvironment || 'PRODUCTION').trim() || 'PRODUCTION';
const changeSummary = (body.changeSummary != null && String(body.changeSummary).trim() !== '') ? String(body.changeSummary) : null;
const basedOnVersionId = $('Montar SQL de contexto').first().json.basedOnVersionId || null;
if (!content.trim()) {
  return [{ json: { ok: false, httpStatus: 400, code: 'CONTENT_REQUIRED', message: 'content é obrigatório para criar uma nova versão.' } }];
}
if (!modelName.trim()) {
  return [{ json: { ok: false, httpStatus: 400, code: 'MODEL_NAME_REQUIRED', message: 'modelName é obrigatório para criar uma nova versão.' } }];
}
const newVersionNumber = Number(row.maxVersion || 0) + 1;
const crypto = require('crypto');
const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
return [{ json: {
  ok: true,
  promptDefinitionId,
  promptCode: row.promptCode,
  purpose: row.purpose,
  newVersionNumber,
  environment,
  content,
  modelName,
  temperature,
  maxTokens,
  topP,
  parameters,
  changeSummary,
  basedOnVersionId,
  contentHash,
  userId,
  requestId: norm.requestId,
} }];`,
    },
  },
  output: [{ json: { ok: true, promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d', newVersionNumber: 3 } }],
});

const criacaoValida = ifElse({
  version: 2.3,
  config: {
    name: 'Criação válida?',
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

const montarSqlCriacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de criação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
function j(v) { return esc(JSON.stringify(v ?? {})); }
const temperatureSql = ctx.temperature != null ? String(Number(ctx.temperature)) : 'NULL';
const maxTokensSql = ctx.maxTokens != null ? String(Number(ctx.maxTokens)) : 'NULL';
const topPSql = ctx.topP != null ? String(Number(ctx.topP)) : 'NULL';
const createdBySql = ctx.userId ? "'" + esc(ctx.userId) + "'::uuid" : 'NULL';
const basedOnSql = ctx.basedOnVersionId ? "'" + esc(ctx.basedOnVersionId) + "'::uuid" : 'NULL';
const changeSummarySql = ctx.changeSummary ? "'" + esc(ctx.changeSummary) + "'" : 'NULL';
const metadata = { createdVia: 'admin_api' };
const sql = "WITH inserted AS (\\n" +
  "  INSERT INTO ai_prompt_versions (\\n" +
  "    prompt_definition_id, version_number, status, environment, content, model_name, temperature, max_tokens, top_p, parameters, change_summary, created_by, based_on_version_id, content_hash, metadata\\n" +
  "  ) VALUES (\\n" +
  "    '" + esc(ctx.promptDefinitionId) + "'::uuid, " + ctx.newVersionNumber + ", 'DRAFT', '" + esc(ctx.environment) + "',\\n" +
  "    '" + esc(ctx.content) + "', '" + esc(ctx.modelName) + "', " + temperatureSql + ", " + maxTokensSql + ", " + topPSql + ",\\n" +
  "    '" + j(ctx.parameters) + "'::jsonb, " + changeSummarySql + ", " + createdBySql + ", " + basedOnSql + ",\\n" +
  "    '" + esc(ctx.contentHash) + "', '" + j(metadata) + "'::jsonb\\n" +
  "  )\\n" +
  "  RETURNING *\\n" +
  ")\\n" +
  "SELECT\\n" +
  "  i.id AS \\"id\\", i.prompt_definition_id AS \\"promptDefinitionId\\", i.version_number AS \\"versionNumber\\",\\n" +
  "  i.status AS \\"status\\", i.environment AS \\"environment\\", i.content AS \\"content\\", i.model_name AS \\"modelName\\",\\n" +
  "  i.temperature AS \\"temperature\\", i.max_tokens AS \\"maxTokens\\", i.top_p AS \\"topP\\", i.parameters AS \\"parameters\\",\\n" +
  "  i.content_hash AS \\"contentHash\\", i.change_summary AS \\"changeSummary\\", i.created_by AS \\"createdBy\\",\\n" +
  "  i.based_on_version_id AS \\"basedOnVersionId\\", i.created_at AS \\"createdAt\\", i.metadata AS \\"metadata\\",\\n" +
  "  d.id AS \\"defId\\", d.code AS \\"defCode\\", d.name AS \\"defName\\", d.description AS \\"defDescription\\",\\n" +
  "  d.purpose AS \\"defPurpose\\", d.active AS \\"defActive\\", d.created_at AS \\"defCreatedAt\\", d.updated_at AS \\"defUpdatedAt\\"\\n" +
  "FROM inserted i\\n" +
  "JOIN ai_prompt_definitions d ON d.id = i.prompt_definition_id;";
return [{ json: { ...ctx, sql } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1' } }],
});

const executarCriacao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Executar criação',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', query: expr('={{ $json.sql }}'), options: {} },
  },
  output: [{ json: { id: 'new-id', promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d', versionNumber: 3, status: 'DRAFT', environment: 'PRODUCTION', content: 'texto', modelName: 'gpt-4.1-mini', temperature: '0.100', maxTokens: 800, topP: null, parameters: {}, contentHash: 'hash3', changeSummary: null, createdBy: null, basedOnVersionId: null, createdAt: '2026-08-03T16:00:00.000Z', metadata: {}, defId: '3560c723-038f-44e9-b370-05038d05947d', defCode: 'AI_QUERY_MAIN', defName: 'Consulta IA', defDescription: null, defPurpose: 'AI_QUERY_MAIN', defActive: true, defCreatedAt: '2026-08-03T14:00:00.000Z', defUpdatedAt: '2026-08-03T14:00:00.000Z' } }],
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
const norm = $('Normalizar request').first().json || {};
let sessionId = '';
try { sessionId = $('Validar auth').first().json.sessionId || ''; } catch (e) {}
const definition = { id: row.defId, code: row.defCode, name: row.defName, purpose: row.defPurpose, description: row.defDescription || null, active: !!row.defActive, createdAt: row.defCreatedAt, updatedAt: row.defUpdatedAt };
const version = {
  id: row.id, promptDefinitionId: row.promptDefinitionId, promptCode: row.defCode, purpose: row.defPurpose,
  versionNumber: row.versionNumber != null ? Number(row.versionNumber) : null, status: row.status, environment: row.environment,
  content: row.content, modelName: row.modelName, temperature: row.temperature != null ? Number(row.temperature) : null,
  maxTokens: row.maxTokens != null ? Number(row.maxTokens) : null, topP: row.topP != null ? Number(row.topP) : null,
  parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
  changeSummary: row.changeSummary || null, contentHash: row.contentHash, createdBy: row.createdBy || null,
  basedOnVersionId: row.basedOnVersionId || null, createdAt: row.createdAt, metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
};
return [{ json: {
  data: { definition, version },
  asList: false,
  statusCode: 201,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId: version.createdBy || '',
  sessionId,
  auditVersionId: version.id,
  auditVersionNumber: version.versionNumber,
  auditModelName: version.modelName,
  auditContentHash: version.contentHash,
  auditPromptDefinitionId: version.promptDefinitionId,
  auditPromptCode: version.promptCode,
} }];`,
    },
  },
  output: [{ json: { data: { definition: {}, version: {} }, asList: false, statusCode: 201, requestId: '11111111-1111-1111-1111-111111111111' } }],
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

const auditarCriacao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditar criação',
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
          action: 'AI_PROMPT_DRAFT_CREATE',
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
            "={{ { promptDefinitionId: $('Montar resultado').first().json.auditPromptDefinitionId, promptCode: $('Montar resultado').first().json.auditPromptCode, versionNumber: $('Montar resultado').first().json.auditVersionNumber, modelName: $('Montar resultado').first().json.auditModelName, contentHash: $('Montar resultado').first().json.auditContentHash } }}",
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
      avaliarCriacao.to(
        criacaoValida
          .onTrue(montarSqlCriacao.to(executarCriacao.to(montarResultado.to(prepararSucesso.to(auditarCriacao.to(repassarResposta.to(respondDynamic))))))) // eslint-disable-line
          .onFalse(prepararErroNegocio.to(respondErroNegocio))
      )
    )
  )
);

export default workflow('post-ai-prompts-create', 'POST System AI Prompts Create')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
