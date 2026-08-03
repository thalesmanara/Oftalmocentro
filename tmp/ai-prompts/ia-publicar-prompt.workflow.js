import { workflow, node, trigger, expr, ifElse, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');
const VALIDAR_WORKFLOW_ID = 'HT0aD7hn73HybpFT';

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'promptVersionId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'forceOverride', type: 'boolean' },
          { name: 'overrideReason', type: 'string' },
          { name: 'validationRunId', type: 'string' },
        ],
      },
    },
    output: [{ json: { promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886', userId: '55555555-5555-5555-5555-555555555555', requestId: '11111111-1111-1111-1111-111111111111', forceOverride: false, overrideReason: '', validationRunId: '' } }],
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
      jsCode: `const trig = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const sql = "SELECT\\n" +
  "  v.id AS \\"promptVersionId\\",\\n" +
  "  v.prompt_definition_id AS \\"promptDefinitionId\\",\\n" +
  "  d.code AS \\"promptCode\\",\\n" +
  "  d.purpose AS \\"purpose\\",\\n" +
  "  v.version_number AS \\"versionNumber\\",\\n" +
  "  v.status AS \\"status\\",\\n" +
  "  v.environment AS \\"environment\\",\\n" +
  "  v.content AS \\"content\\",\\n" +
  "  v.model_name AS \\"modelName\\",\\n" +
  "  v.temperature AS \\"temperature\\",\\n" +
  "  v.max_tokens AS \\"maxTokens\\",\\n" +
  "  v.top_p AS \\"topP\\",\\n" +
  "  v.parameters AS \\"parameters\\",\\n" +
  "  v.content_hash AS \\"contentHash\\",\\n" +
  "  v.validation_run_id AS \\"versionValidationRunId\\",\\n" +
  "  v.validation_score AS \\"validationScore\\",\\n" +
  "  cp.id AS \\"currentPublishedId\\",\\n" +
  "  cp.validation_score AS \\"currentPublishedScore\\",\\n" +
  "  cp.version_number AS \\"currentPublishedVersionNumber\\"\\n" +
  "FROM ai_prompt_versions v\\n" +
  "JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id\\n" +
  "LEFT JOIN ai_prompt_versions cp\\n" +
  "  ON cp.prompt_definition_id = v.prompt_definition_id\\n" +
  "  AND cp.environment = v.environment\\n" +
  "  AND cp.status = 'PUBLISHED'\\n" +
  "  AND cp.id <> v.id\\n" +
  "WHERE v.id = '" + esc(trig.promptVersionId) + "'::uuid;";
return [{ json: { sql, userId: trig.userId || null, requestId: trig.requestId || null, forceOverride: !!trig.forceOverride, overrideReason: String(trig.overrideReason || '').trim(), requestedValidationRunId: String(trig.validationRunId || '').trim() } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', userId: '55555555-5555-5555-5555-555555555555', requestId: '11111111-1111-1111-1111-111111111111', forceOverride: false, overrideReason: '', requestedValidationRunId: '' } }],
});

const carregarContexto = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar contexto',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [
    {
      json: {
        promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886',
        promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d',
        promptCode: 'AI_QUERY_MAIN',
        purpose: 'AI_QUERY_MAIN',
        versionNumber: 2,
        status: 'DRAFT',
        environment: 'PRODUCTION',
        content: 'Texto v2',
        modelName: 'gpt-4.1-mini',
        temperature: '0.100',
        maxTokens: 800,
        topP: null,
        parameters: {},
        contentHash: 'hash2',
        versionValidationRunId: null,
        validationScore: null,
        currentPublishedId: 'a23741ae-2cef-46c6-8690-f603fc3fe569',
        currentPublishedScore: null,
        currentPublishedVersionNumber: 1,
      },
    },
  ],
});

const avaliarEstado = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar estado',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const ctx = $('Montar SQL de contexto').first().json || {};
if (!row || !row.promptVersionId) {
  return [{ json: { ok: false, code: 'VERSION_NOT_FOUND', message: 'Versão de prompt não encontrada.' } }];
}
if (!['DRAFT', 'VALIDATING'].includes(row.status)) {
  return [{ json: { ok: false, code: 'INVALID_STATE', message: "Versão está em status '" + row.status + "'; apenas DRAFT ou VALIDATING podem ser publicadas." } }];
}
return [{ json: {
  ok: true,
  promptVersionId: row.promptVersionId,
  promptDefinitionId: row.promptDefinitionId,
  promptCode: row.promptCode,
  purpose: row.purpose,
  versionNumber: row.versionNumber != null ? Number(row.versionNumber) : null,
  status: row.status,
  environment: row.environment,
  content: row.content,
  modelName: row.modelName,
  temperature: row.temperature != null ? Number(row.temperature) : null,
  maxTokens: row.maxTokens != null ? Number(row.maxTokens) : null,
  topP: row.topP != null ? Number(row.topP) : null,
  parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
  contentHash: row.contentHash,
  versionValidationRunId: row.versionValidationRunId || null,
  validationScore: row.validationScore != null ? Number(row.validationScore) : null,
  currentPublishedId: row.currentPublishedId || null,
  currentPublishedScore: row.currentPublishedScore != null ? Number(row.currentPublishedScore) : null,
  currentPublishedVersionNumber: row.currentPublishedVersionNumber != null ? Number(row.currentPublishedVersionNumber) : null,
  userId: ctx.userId,
  requestId: ctx.requestId,
  forceOverride: ctx.forceOverride,
  overrideReason: ctx.overrideReason,
  requestedValidationRunId: ctx.requestedValidationRunId,
} }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886', status: 'DRAFT', environment: 'PRODUCTION' } }],
});

const estadoValido = ifElse({
  version: 2.3,
  config: {
    name: 'Estado válido?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'e1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const bloqueadoPorEstado = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Bloqueado por estado', parameters: {} }, output: [{ json: { ok: false, code: 'INVALID_STATE' } }] });

const chamarValidacao = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Chamar validação',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: VALIDAR_WORKFLOW_ID, cachedResultName: 'IA - VALIDAR CONFIGURAÇÃO DO PROMPT' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          content: expr('={{ $json.content }}'),
          modelName: expr('={{ $json.modelName }}'),
          temperature: expr('={{ $json.temperature }}'),
          maxTokens: expr('={{ $json.maxTokens }}'),
          parameters: expr('={{ $json.parameters }}'),
          status: expr('={{ $json.status }}'),
        },
      },
    },
  },
  output: [{ json: { ok: true, errors: [], warnings: [] } }],
});

const avaliarValidacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar validação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const val = $input.first().json || {};
const ctx = $('Avaliar estado').first().json || {};
if (!val.ok) {
  return [{ json: { ok: false, code: 'VALIDATION_FAILED', message: 'Falha na validação da configuração do prompt.', errors: val.errors || [], warnings: val.warnings || [] } }];
}
return [{ json: { ...ctx, ok: true, validationWarnings: val.warnings || [] } }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886' } }],
});

const validacaoAprovada = ifElse({
  version: 2.3,
  config: {
    name: 'Validação aprovada?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'v1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const bloqueadoPorValidacao = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Bloqueado por validação', parameters: {} }, output: [{ json: { ok: false, code: 'VALIDATION_FAILED' } }] });

const montarSqlTeste = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de teste',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const effectiveValidationRunId = String(ctx.requestedValidationRunId || '').trim() || String(ctx.versionValidationRunId || '').trim();
let sql;
if (effectiveValidationRunId) {
  sql = "SELECT id, status, finished_at, overall_score, total_cases, passed_count, failed_count, error_count FROM ai_test_runs WHERE id = '" + esc(effectiveValidationRunId) + "'::uuid;";
} else {
  sql = "SELECT id, status, finished_at, overall_score, total_cases, passed_count, failed_count, error_count FROM ai_test_runs WHERE false;";
}
return [{ json: { ...ctx, sql, effectiveValidationRunId: effectiveValidationRunId || null } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', effectiveValidationRunId: null } }],
});

const carregarExecucaoTeste = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar execução de teste',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [{ json: { id: null } }],
});

const carregarLimiarRegressao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar limiar de regressão',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', options: {}, query: expr("SELECT value FROM app_secrets WHERE key = 'ai_prompt_regression_threshold';") },
  },
  output: [{ json: { value: '2' } }],
});

const avaliarRegressao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar regressão',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const secretRows = $input.all().map((i) => i.json);
const secretRow = secretRows.find((r) => r && r.value != null);
const threshold = secretRow ? Number(secretRow.value) : 2;
const testRows = $('Carregar execução de teste').all().map((i) => i.json);
const run = testRows.find((r) => r && r.id) || null;
const ctx = $('Montar SQL de teste').first().json || {};

const forceOverride = !!ctx.forceOverride;
const overrideReason = String(ctx.overrideReason || '').trim();

if (ctx.environment !== 'PRODUCTION') {
  return [{ json: { ...ctx, ok: true, overrideUsed: false, regressionInfo: null } }];
}

function blockUnlessOverride(code, message) {
  if (forceOverride && overrideReason) {
    return { json: { ...ctx, ok: true, overrideUsed: true, overrideCode: code, regressionInfo: null } };
  }
  return { json: { ok: false, code, message } };
}

if (!ctx.effectiveValidationRunId) {
  return [blockUnlessOverride('NO_VALIDATION_RUN', 'Nenhuma execução de teste vinculada; publicação em PRODUCTION requer validationRunId ou forceOverride com overrideReason.')];
}
const isComplete = run && run.finished_at && !['STARTED', 'RUNNING'].includes(String(run.status || '').toUpperCase());
if (!isComplete || run.overall_score == null) {
  return [blockUnlessOverride('INCOMPLETE_VALIDATION_RUN', 'Execução de teste referenciada não está concluída ou não possui overall_score.')];
}
const overallScore = Number(run.overall_score);
const currentScore = ctx.currentPublishedScore != null ? Number(ctx.currentPublishedScore) : null;
if (currentScore != null) {
  const regression = currentScore - overallScore;
  if (regression > threshold) {
    return [blockUnlessOverride('REGRESSION_DETECTED', 'Regressão de score detectada (' + regression.toFixed(2) + ' > limiar ' + threshold + ').')];
  }
}
return [{ json: { ...ctx, ok: true, overrideUsed: false, regressionInfo: { overallScore, currentScore, threshold } } }];`,
    },
  },
  output: [{ json: { ok: true, overrideUsed: false, regressionInfo: null } }],
});

const regressaoAprovada = ifElse({
  version: 2.3,
  config: {
    name: 'Regressão aprovada?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'r1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const bloqueadoPorRegressao = node({ type: 'n8n-nodes-base.noOp', version: 1, config: { name: 'Bloqueado por regressão', parameters: {} }, output: [{ json: { ok: false, code: 'REGRESSION_DETECTED' } }] });

const montarSqlPublicacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de publicação',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const regInfo = ctx.regressionInfo || {};
const validationScoreSql = regInfo.overallScore != null ? String(Number(regInfo.overallScore)) : 'NULL';
const validationRunIdSql = ctx.effectiveValidationRunId ? "'" + esc(ctx.effectiveValidationRunId) + "'::uuid" : 'NULL';
const publishedBySql = ctx.userId ? "'" + esc(ctx.userId) + "'::uuid" : 'NULL';

const archiveSql = ctx.currentPublishedId
  ? "archived AS (\\n  UPDATE ai_prompt_versions SET status = 'ARCHIVED', archived_at = now()\\n  WHERE id = '" + esc(ctx.currentPublishedId) + "'::uuid\\n  RETURNING id\\n),\\n"
  : '';

const sql = "WITH " + archiveSql +
  "published AS (\\n" +
  "  UPDATE ai_prompt_versions\\n" +
  "  SET status = 'PUBLISHED', published_at = now(), published_by = " + publishedBySql + ",\\n" +
  "      validation_run_id = " + validationRunIdSql + ", validation_score = " + validationScoreSql + "\\n" +
  "  WHERE id = '" + esc(ctx.promptVersionId) + "'::uuid\\n" +
  "  RETURNING id, prompt_definition_id, version_number, status, environment, content_hash, published_at, model_name\\n" +
  "),\\n" +
  "secret_upd AS (\\n" +
  "  UPDATE app_secrets SET value = (SELECT '" + esc(ctx.promptCode) + "' || '@v' || version_number || ':' || substring(content_hash from 1 for 12) FROM published)\\n" +
  "  WHERE key = 'ai_eval_prompt_version'\\n" +
  "  RETURNING key\\n" +
  "),\\n" +
  "secret_ins AS (\\n" +
  "  INSERT INTO app_secrets (key, value)\\n" +
  "  SELECT 'ai_eval_prompt_version', '" + esc(ctx.promptCode) + "' || '@v' || version_number || ':' || substring(content_hash from 1 for 12) FROM published\\n" +
  "  WHERE NOT EXISTS (SELECT 1 FROM secret_upd)\\n" +
  "  RETURNING key\\n" +
  ")\\n" +
  "SELECT * FROM published;";
return [{ json: { ...ctx, sql } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1' } }],
});

const executarPublicacao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Executar publicação',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [{ json: { id: '279a2ddd-9b80-4661-9a07-4cdf5066e886', prompt_definition_id: '3560c723-038f-44e9-b370-05038d05947d', version_number: 2, status: 'PUBLISHED', environment: 'PRODUCTION', content_hash: 'hash2', published_at: '2026-08-03T16:00:00.000Z', model_name: 'gpt-4.1-mini' } }],
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
const ctx = $('Montar SQL de publicação').first().json || {};
return [{ json: {
  ok: true,
  promptVersionId: row.id,
  promptDefinitionId: row.prompt_definition_id,
  promptCode: ctx.promptCode,
  purpose: ctx.purpose,
  versionNumber: row.version_number != null ? Number(row.version_number) : null,
  status: row.status,
  environment: row.environment,
  contentHash: row.content_hash,
  publishedAt: row.published_at,
  modelName: row.model_name,
  archivedPreviousId: ctx.currentPublishedId || null,
  overrideUsed: !!ctx.overrideUsed,
  overrideReason: ctx.overrideReason || null,
  validationRunId: ctx.effectiveValidationRunId || null,
} }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: '279a2ddd-9b80-4661-9a07-4cdf5066e886', versionNumber: 2, status: 'PUBLISHED' } }],
});

export default workflow('ia-publicar-prompt', 'IA - PUBLICAR PROMPT')
  .add(trig)
  .to(montarSqlContexto)
  .to(carregarContexto)
  .to(avaliarEstado)
  .to(
    estadoValido
      .onTrue(
        chamarValidacao
          .to(avaliarValidacao)
          .to(
            validacaoAprovada
              .onTrue(
                montarSqlTeste
                  .to(carregarExecucaoTeste)
                  .to(carregarLimiarRegressao)
                  .to(avaliarRegressao)
                  .to(
                    regressaoAprovada
                      .onTrue(montarSqlPublicacao.to(executarPublicacao).to(montarResultado))
                      .onFalse(bloqueadoPorRegressao)
                  )
              )
              .onFalse(bloqueadoPorValidacao)
          )
      )
      .onFalse(bloqueadoPorEstado)
  );
