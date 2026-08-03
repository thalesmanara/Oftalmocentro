import { workflow, node, trigger, expr, ifElse, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'promptDefinitionId', type: 'string' },
          { name: 'purpose', type: 'string' },
          { name: 'code', type: 'string' },
          { name: 'targetVersionId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'reason', type: 'string' },
        ],
      },
    },
    output: [{ json: { promptDefinitionId: '', purpose: 'AI_QUERY_MAIN', code: '', targetVersionId: 'a23741ae-2cef-46c6-8690-f603fc3fe569', userId: '55555555-5555-5555-5555-555555555555', requestId: '11111111-1111-1111-1111-111111111111', reason: 'Rollback manual' } }],
  },
});

const carregarContexto = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar definição e alvo',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'WITH def AS (\n' +
          '  SELECT d.id, d.code, d.purpose\n' +
          '  FROM ai_prompt_definitions d\n' +
          "  WHERE (\n" +
          "    ('{{ $json.promptDefinitionId || \"\" }}' <> '' AND d.id = '{{ $json.promptDefinitionId || \"\" }}'::uuid)\n" +
          "    OR ('{{ $json.promptDefinitionId || \"\" }}' = '' AND (\n" +
          "      ('{{ ($json.code || \"\").replace(/'/g, \"''\") }}' <> '' AND d.code = '{{ ($json.code || \"\").replace(/'/g, \"''\") }}')\n" +
          "      OR ('{{ ($json.code || \"\").replace(/'/g, \"''\") }}' = '' AND '{{ ($json.purpose || \"\").replace(/'/g, \"''\") }}' <> '' AND d.purpose = '{{ ($json.purpose || \"\").replace(/'/g, \"''\") }}')\n" +
          '    ))\n' +
          '  )\n' +
          '  LIMIT 1\n' +
          '),\n' +
          'target AS (\n' +
          '  SELECT v.* FROM ai_prompt_versions v\n' +
          "  WHERE v.id = '{{ $json.targetVersionId }}'::uuid AND v.prompt_definition_id = (SELECT id FROM def)\n" +
          '),\n' +
          'maxv AS (\n' +
          '  SELECT COALESCE(MAX(version_number), 0) AS max_version FROM ai_prompt_versions WHERE prompt_definition_id = (SELECT id FROM def)\n' +
          '),\n' +
          'pub AS (\n' +
          '  SELECT id FROM ai_prompt_versions WHERE prompt_definition_id = (SELECT id FROM def) AND environment = (SELECT environment FROM target) AND status = \'PUBLISHED\'\n' +
          ')\n' +
          'SELECT\n' +
          '  (SELECT id FROM def) AS "promptDefinitionId",\n' +
          '  (SELECT code FROM def) AS "promptCode",\n' +
          '  (SELECT purpose FROM def) AS "purpose",\n' +
          '  t.id AS "targetVersionId",\n' +
          '  t.version_number AS "targetVersionNumber",\n' +
          '  t.content AS "content",\n' +
          '  t.model_name AS "modelName",\n' +
          '  t.temperature AS "temperature",\n' +
          '  t.max_tokens AS "maxTokens",\n' +
          '  t.top_p AS "topP",\n' +
          '  t.parameters AS "parameters",\n' +
          '  t.content_hash AS "contentHash",\n' +
          '  t.environment AS "environment",\n' +
          '  (SELECT max_version FROM maxv) AS "maxVersion",\n' +
          '  (SELECT id FROM pub) AS "currentPublishedId"\n' +
          'FROM target t;'
      ),
    },
  },
  output: [
    {
      json: {
        promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d',
        promptCode: 'AI_QUERY_MAIN',
        purpose: 'AI_QUERY_MAIN',
        targetVersionId: 'a23741ae-2cef-46c6-8690-f603fc3fe569',
        targetVersionNumber: 1,
        content: 'Texto v1',
        modelName: 'gpt-4.1-mini',
        temperature: '0.100',
        maxTokens: 800,
        topP: null,
        parameters: {},
        contentHash: '9faa2e45657182381ca77c68dfa2e209e1081178b212537d8d321d171cb06978',
        environment: 'PRODUCTION',
        maxVersion: 2,
        currentPublishedId: '279a2ddd-9b80-4661-9a07-4cdf5066e886',
      },
    },
  ],
});

const avaliarRollback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar rollback',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const trig = $('Trigger').first().json || {};
if (!row || !row.promptDefinitionId || !row.targetVersionId) {
  return [{ json: { ok: false, code: 'NOT_FOUND', message: 'Definição de prompt ou versão alvo não encontrada.' } }];
}
const newVersionNumber = Number(row.maxVersion || 0) + 1;
return [{ json: {
  ...row,
  ok: true,
  newVersionNumber,
  userId: trig.userId || null,
  requestId: trig.requestId || null,
  reason: trig.reason || 'Rollback de prompt',
} }];`,
    },
  },
  output: [{ json: { ok: true, newVersionNumber: 3, promptDefinitionId: 'x', targetVersionId: 'y' } }],
});

const rollbackOk = ifElse({
  version: 2.3,
  config: {
    name: 'Rollback possível?',
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

const montarSqlRollback = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar SQL de rollback',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ctx = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
function j(v) { return esc(JSON.stringify(v ?? {})); }
const params = ctx.parameters && typeof ctx.parameters === 'object' ? ctx.parameters : {};
const metadata = { rollback: true, rollbackFromVersionId: ctx.targetVersionId, rollbackReason: ctx.reason || null };
const temperatureSql = ctx.temperature != null && ctx.temperature !== '' ? String(Number(ctx.temperature)) : 'NULL';
const maxTokensSql = ctx.maxTokens != null && ctx.maxTokens !== '' ? String(Number(ctx.maxTokens)) : 'NULL';
const topPSql = ctx.topP != null && ctx.topP !== '' ? String(Number(ctx.topP)) : 'NULL';
const publishedByUuid = ctx.userId ? "'" + esc(ctx.userId) + "'::uuid" : 'NULL';
const changeSummary = 'Rollback para versão ' + ctx.targetVersionNumber + ' (clone) via ' + (ctx.reason ? esc(ctx.reason) : 'ação administrativa') + '.';

const archiveSql = ctx.currentPublishedId
  ? "archived AS (\\n  UPDATE ai_prompt_versions SET status = 'ARCHIVED', archived_at = now()\\n  WHERE id = '" + esc(ctx.currentPublishedId) + "'::uuid\\n  RETURNING id\\n),\\n"
  : '';

const sql = "WITH " + archiveSql +
  "inserted AS (\\n" +
  "  INSERT INTO ai_prompt_versions (\\n" +
  "    prompt_definition_id, version_number, status, environment, content, model_name, temperature, max_tokens, top_p, parameters, change_summary, created_by, published_by, published_at, based_on_version_id, content_hash, metadata\\n" +
  "  ) VALUES (\\n" +
  "    '" + esc(ctx.promptDefinitionId) + "'::uuid, " + ctx.newVersionNumber + ", 'PUBLISHED', '" + esc(ctx.environment) + "',\\n" +
  "    '" + esc(ctx.content) + "', '" + esc(ctx.modelName) + "', " + temperatureSql + ", " + maxTokensSql + ", " + topPSql + ",\\n" +
  "    '" + j(params) + "'::jsonb, '" + esc(changeSummary) + "', " + publishedByUuid + ", " + publishedByUuid + ", now(),\\n" +
  "    '" + esc(ctx.targetVersionId) + "'::uuid, '" + esc(ctx.contentHash) + "', '" + j(metadata) + "'::jsonb\\n" +
  "  )\\n" +
  "  RETURNING id, prompt_definition_id, version_number, status, environment, content_hash, published_at, model_name\\n" +
  "),\\n" +
  "secret_upd AS (\\n" +
  "  UPDATE app_secrets SET value = (SELECT '" + esc(ctx.promptCode) + "' || '@v' || i.version_number || ':' || substring(i.content_hash from 1 for 12) FROM inserted i)\\n" +
  "  WHERE key = 'ai_eval_prompt_version'\\n" +
  "  RETURNING key\\n" +
  "),\\n" +
  "secret_ins AS (\\n" +
  "  INSERT INTO app_secrets (key, value)\\n" +
  "  SELECT 'ai_eval_prompt_version', '" + esc(ctx.promptCode) + "' || '@v' || i.version_number || ':' || substring(i.content_hash from 1 for 12) FROM inserted i\\n" +
  "  WHERE NOT EXISTS (SELECT 1 FROM secret_upd)\\n" +
  "  RETURNING key\\n" +
  ")\\n" +
  "SELECT * FROM inserted;";
return [{ json: { ...ctx, sql } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', promptCode: 'AI_QUERY_MAIN' } }],
});

const executarRollback = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Executar rollback',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [{ json: { id: '99999999-9999-9999-9999-999999999999', prompt_definition_id: '3560c723-038f-44e9-b370-05038d05947d', version_number: 3, status: 'PUBLISHED', environment: 'PRODUCTION', content_hash: 'hash', published_at: '2026-08-03T15:00:00.000Z', model_name: 'gpt-4.1-mini' } }],
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
const ctx = $('Montar SQL de rollback').first().json || {};
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
  basedOnVersionId: ctx.targetVersionId,
  rolledBackFromPublishedId: ctx.currentPublishedId || null,
} }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: 'z', versionNumber: 3, status: 'PUBLISHED' } }],
});

const montarBloqueio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar bloqueio',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
return [{ json: { ok: false, code: row.code || 'ROLLBACK_BLOCKED', message: row.message || 'Não foi possível executar o rollback.' } }];`,
    },
  },
  output: [{ json: { ok: false, code: 'NOT_FOUND', message: 'Definição de prompt ou versão alvo não encontrada.' } }],
});

export default workflow('ia-rollback-prompt', 'IA - ROLLBACK DE PROMPT')
  .add(trig)
  .to(carregarContexto)
  .to(avaliarRollback)
  .to(
    rollbackOk
      .onTrue(montarSqlRollback.to(executarRollback).to(montarResultado))
      .onFalse(montarBloqueio)
  );
