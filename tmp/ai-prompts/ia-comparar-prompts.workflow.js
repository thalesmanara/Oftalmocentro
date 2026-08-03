import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

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
          { name: 'versionIdA', type: 'string' },
          { name: 'versionIdB', type: 'string' },
        ],
      },
    },
    output: [{ json: { versionIdA: 'a23741ae-2cef-46c6-8690-f603fc3fe569', versionIdB: '279a2ddd-9b80-4661-9a07-4cdf5066e886' } }],
  },
});

const carregarVersoes = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar versões',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'SELECT\n' +
          '  v.id AS "id",\n' +
          '  v.version_number AS "versionNumber",\n' +
          '  v.status AS "status",\n' +
          '  v.environment AS "environment",\n' +
          '  v.content AS "content",\n' +
          '  v.model_name AS "modelName",\n' +
          '  v.temperature AS "temperature",\n' +
          '  v.max_tokens AS "maxTokens",\n' +
          '  v.top_p AS "topP",\n' +
          '  v.parameters AS "parameters",\n' +
          '  v.content_hash AS "contentHash",\n' +
          '  v.validation_score AS "validationScore",\n' +
          '  v.published_at AS "publishedAt",\n' +
          '  d.code AS "promptCode",\n' +
          '  d.purpose AS "purpose"\n' +
          'FROM ai_prompt_versions v\n' +
          'JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id\n' +
          "WHERE v.id IN ('{{ $json.versionIdA }}'::uuid, '{{ $json.versionIdB }}'::uuid);"
      ),
    },
  },
  output: [
    { json: { id: 'a23741ae-2cef-46c6-8690-f603fc3fe569', versionNumber: 1, status: 'PUBLISHED', environment: 'PRODUCTION', content: 'Texto v1', modelName: 'gpt-4.1-mini', temperature: '0.100', maxTokens: 800, topP: null, parameters: {}, contentHash: 'hash1', validationScore: null, publishedAt: '2026-08-03T14:08:50.369Z', promptCode: 'AI_QUERY_MAIN', purpose: 'AI_QUERY_MAIN' } },
    { json: { id: '279a2ddd-9b80-4661-9a07-4cdf5066e886', versionNumber: 2, status: 'DRAFT', environment: 'PRODUCTION', content: 'Texto v2', modelName: 'gpt-4.1-mini', temperature: '0.100', maxTokens: 800, topP: null, parameters: { antiInjection: true }, contentHash: 'hash2', validationScore: null, publishedAt: null, promptCode: 'AI_QUERY_MAIN', purpose: 'AI_QUERY_MAIN' } },
  ],
});

const montarDiff = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar diff',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const rows = $input.all().map((i) => i.json);
const trig = $('Trigger').first().json || {};
const idA = String(trig.versionIdA || '');
const idB = String(trig.versionIdB || '');
const a = rows.find((r) => String(r.id) === idA) || null;
const b = rows.find((r) => String(r.id) === idB) || null;
if (!a || !b) {
  return [{ json: { ok: false, code: 'VERSION_NOT_FOUND' } }];
}

function diffLines(la, lb) {
  const n = la.length;
  const m = lb.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (la[i] === lb[j]) { ops.push({ type: 'equal', line: la[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'removed', line: la[i] }); i++; }
    else { ops.push({ type: 'added', line: lb[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'removed', line: la[i] }); i++; }
  while (j < m) { ops.push({ type: 'added', line: lb[j] }); j++; }
  return ops;
}

const linesA = String(a.content || '').split('\\n');
const linesB = String(b.content || '').split('\\n');
const ops = diffLines(linesA, linesB);
const changed = ops.filter((o) => o.type !== 'equal');
const addedLines = changed.filter((o) => o.type === 'added').length;
const removedLines = changed.filter((o) => o.type === 'removed').length;
const preview = changed.slice(0, 20).map((o) => ({ type: o.type, line: o.line }));

const paramsA = a.parameters && typeof a.parameters === 'object' ? a.parameters : {};
const paramsB = b.parameters && typeof b.parameters === 'object' ? b.parameters : {};
const paramKeys = new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]);
const parametersDiffKeys = [...paramKeys].filter((k) => JSON.stringify(paramsA[k]) !== JSON.stringify(paramsB[k]));

function summarize(v) {
  return {
    id: v.id,
    versionNumber: v.versionNumber != null ? Number(v.versionNumber) : null,
    status: v.status,
    environment: v.environment,
    modelName: v.modelName,
    temperature: v.temperature != null ? Number(v.temperature) : null,
    maxTokens: v.maxTokens != null ? Number(v.maxTokens) : null,
    topP: v.topP != null ? Number(v.topP) : null,
    contentHash: v.contentHash,
    contentLength: String(v.content || '').length,
    validationScore: v.validationScore != null ? Number(v.validationScore) : null,
    publishedAt: v.publishedAt || null,
    promptCode: v.promptCode,
    purpose: v.purpose,
  };
}

return [{ json: {
  ok: true,
  versionA: summarize(a),
  versionB: summarize(b),
  parametersDiffKeys,
  diff: { addedLines, removedLines, changedLines: addedLines + removedLines, preview },
} }];`,
    },
  },
  output: [{ json: { ok: true, versionA: { id: 'a', versionNumber: 1 }, versionB: { id: 'b', versionNumber: 2 }, parametersDiffKeys: [], diff: { addedLines: 3, removedLines: 1, changedLines: 4, preview: [] } } }],
});

export default workflow('ia-comparar-prompts', 'IA - COMPARAR PROMPTS')
  .add(trig)
  .to(carregarVersoes)
  .to(montarDiff);
