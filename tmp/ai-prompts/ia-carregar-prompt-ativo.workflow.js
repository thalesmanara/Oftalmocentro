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
          { name: 'purpose', type: 'string' },
          { name: 'code', type: 'string' },
          { name: 'environment', type: 'string' },
          { name: 'promptVersionId', type: 'string' },
          { name: 'requestId', type: 'string' },
        ],
      },
    },
    output: [
      { json: { purpose: 'AI_QUERY_MAIN', code: '', environment: 'PRODUCTION', promptVersionId: '', requestId: '11111111-1111-1111-1111-111111111111' } },
    ],
  },
});

const montarConsulta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar consulta',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const trig = $input.first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const promptVersionId = String(trig.promptVersionId || '').trim();
const purpose = String(trig.purpose || 'AI_QUERY_MAIN').trim() || 'AI_QUERY_MAIN';
const code = String(trig.code || '').trim();
const environment = String(trig.environment || 'PRODUCTION').trim() || 'PRODUCTION';
const requestId = String(trig.requestId || '').trim();
let where;
if (promptVersionId) {
  where = "v.id = '" + esc(promptVersionId) + "'::uuid";
} else {
  const parts = ["d.purpose = '" + esc(purpose) + "'", "v.environment = '" + esc(environment) + "'", "v.status = 'PUBLISHED'"];
  if (code) parts.push("d.code = '" + esc(code) + "'");
  where = parts.join(' AND ');
}
const sql = "SELECT\\n" +
  "  v.id AS \\"promptVersionId\\",\\n" +
  "  v.prompt_definition_id AS \\"promptDefinitionId\\",\\n" +
  "  d.code AS \\"promptCode\\",\\n" +
  "  d.purpose AS \\"purpose\\",\\n" +
  "  v.version_number AS \\"versionNumber\\",\\n" +
  "  v.content AS \\"content\\",\\n" +
  "  v.model_name AS \\"modelName\\",\\n" +
  "  v.temperature AS \\"temperature\\",\\n" +
  "  v.max_tokens AS \\"maxTokens\\",\\n" +
  "  v.top_p AS \\"topP\\",\\n" +
  "  v.parameters AS \\"parameters\\",\\n" +
  "  v.content_hash AS \\"contentHash\\",\\n" +
  "  v.published_at AS \\"publishedAt\\",\\n" +
  "  v.status AS \\"status\\",\\n" +
  "  v.environment AS \\"environment\\"\\n" +
  "FROM ai_prompt_versions v\\n" +
  "JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id\\n" +
  "WHERE " + where + "\\n" +
  "ORDER BY v.version_number DESC\\n" +
  "LIMIT 1;";
return [{ json: { sql, purpose, environment, requestId } }];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', purpose: 'AI_QUERY_MAIN', environment: 'PRODUCTION', requestId: '11111111-1111-1111-1111-111111111111' } }],
});

const carregarVersao = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar versão',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [
    {
      json: {
        promptVersionId: 'a23741ae-2cef-46c6-8690-f603fc3fe569',
        promptDefinitionId: '3560c723-038f-44e9-b370-05038d05947d',
        promptCode: 'AI_QUERY_MAIN',
        purpose: 'AI_QUERY_MAIN',
        versionNumber: 1,
        content: 'Você é a IA interna da Oftalmocentro...',
        modelName: 'gpt-4.1-mini',
        temperature: '0.100',
        maxTokens: 800,
        topP: null,
        parameters: { userMessageTemplate: 'Pergunta do usuário:\n\n{{ $json.question }}' },
        contentHash: '9faa2e45657182381ca77c68dfa2e209e1081178b212537d8d321d171cb06978',
        publishedAt: '2026-08-03T14:08:50.369Z',
        status: 'PUBLISHED',
        environment: 'PRODUCTION',
      },
    },
  ],
});

const normalizarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalizar resposta',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const ctx = $('Montar consulta').first().json || {};
const row = $input.first().json || {};
if (!row || !row.promptVersionId) {
  return [{ json: {
    ok: false,
    code: 'PROMPT_NOT_FOUND',
    promptDefinitionId: null,
    promptVersionId: null,
    promptCode: null,
    purpose: ctx.purpose || null,
    versionNumber: null,
    content: null,
    modelName: null,
    temperature: null,
    maxTokens: null,
    topP: null,
    parameters: {},
    contentHash: null,
    publishedAt: null,
    status: null,
    environment: ctx.environment || null,
    userMessageTemplate: null,
  } }];
}
const params = row.parameters && typeof row.parameters === 'object' ? row.parameters : {};
return [{ json: {
  ok: true,
  code: null,
  promptDefinitionId: row.promptDefinitionId,
  promptVersionId: row.promptVersionId,
  promptCode: row.promptCode,
  purpose: row.purpose,
  versionNumber: row.versionNumber != null ? Number(row.versionNumber) : null,
  content: row.content,
  modelName: row.modelName,
  temperature: row.temperature != null ? Number(row.temperature) : null,
  maxTokens: row.maxTokens != null ? Number(row.maxTokens) : null,
  topP: row.topP != null ? Number(row.topP) : null,
  parameters: params,
  contentHash: row.contentHash,
  publishedAt: row.publishedAt,
  status: row.status,
  environment: row.environment,
  userMessageTemplate: params.userMessageTemplate || null,
} }];`,
    },
  },
  output: [{ json: { ok: true, promptVersionId: 'a23741ae-2cef-46c6-8690-f603fc3fe569', versionNumber: 1, content: '...', modelName: 'gpt-4.1-mini', temperature: 0.1, maxTokens: 800, userMessageTemplate: '...' } }],
});

export default workflow('ia-carregar-prompt-ativo', 'IA - CARREGAR PROMPT ATIVO')
  .add(trig)
  .to(montarConsulta)
  .to(carregarVersao)
  .to(normalizarResposta);
