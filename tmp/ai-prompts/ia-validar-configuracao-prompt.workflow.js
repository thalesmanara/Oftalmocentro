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
          { name: 'content', type: 'string' },
          { name: 'modelName', type: 'string' },
          { name: 'temperature', type: 'number' },
          { name: 'maxTokens', type: 'number' },
          { name: 'parameters', type: 'object' },
          { name: 'status', type: 'string' },
        ],
      },
    },
    output: [{ json: { content: 'Você é a IA interna...', modelName: 'gpt-4.1-mini', temperature: 0.1, maxTokens: 800, parameters: {}, status: 'DRAFT' } }],
  },
});

const carregarLimites = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar limites',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        "SELECT key, value FROM app_secrets WHERE key IN ('ai_prompt_allowed_models','ai_prompt_max_temperature','ai_prompt_max_tokens_limit');"
      ),
    },
  },
  output: [
    { json: { key: 'ai_prompt_allowed_models', value: 'gpt-4.1-mini,gpt-4.1,gpt-4o-mini,gpt-4o' } },
    { json: { key: 'ai_prompt_max_temperature', value: '1.0' } },
    { json: { key: 'ai_prompt_max_tokens_limit', value: '4096' } },
  ],
});

const validar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const rows = $input.all().map((i) => i.json);
const secrets = {};
for (const r of rows) secrets[r.key] = r.value;
const trig = $('Trigger').first().json || {};
const content = String(trig.content ?? '');
const modelName = String(trig.modelName ?? '');
const temperature = trig.temperature != null && trig.temperature !== '' ? Number(trig.temperature) : null;
const maxTokens = trig.maxTokens != null && trig.maxTokens !== '' ? Number(trig.maxTokens) : null;
let parameters = trig.parameters;
if (typeof parameters === 'string') {
  try { parameters = JSON.parse(parameters || '{}'); } catch (_) { parameters = {}; }
}
parameters = parameters && typeof parameters === 'object' ? parameters : {};
const status = String(trig.status ?? '');

const errors = [];
const warnings = [];

if (!content.trim()) errors.push('content é obrigatório e não pode ser vazio.');

const allowedModels = String(secrets.ai_prompt_allowed_models || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (allowedModels.length && !allowedModels.includes(modelName)) {
  errors.push("modelName '" + modelName + "' não está na allowlist (" + allowedModels.join(', ') + ').');
}

const maxTemperature = Number(secrets.ai_prompt_max_temperature || '1.0');
if (temperature == null || Number.isNaN(temperature)) {
  errors.push('temperature é obrigatório e deve ser numérico.');
} else if (temperature < 0 || temperature > maxTemperature) {
  errors.push('temperature deve estar entre 0 e ' + maxTemperature + '.');
}

const maxTokensLimit = Number(secrets.ai_prompt_max_tokens_limit || '4096');
if (maxTokens != null) {
  if (!Number.isFinite(maxTokens) || maxTokens < 1 || maxTokens > maxTokensLimit) {
    errors.push('maxTokens deve estar entre 1 e ' + maxTokensLimit + ' (ou nulo).');
  }
}

const secretPatterns = [
  { name: 'openai_api_key', re: /sk-[A-Za-z0-9_-]{10,}/ },
  { name: 'generic_api_key', re: /\\bapi[_-]?key\\b\\s*[:=]/i },
  { name: 'bearer_jwt', re: /bearer\\s+[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}/i },
  { name: 'password_assignment', re: /\\bpassword\\b\\s*[:=]/i },
  { name: 'postgres_uri', re: /postgres(ql)?:\\/\\/[^\\s'"]+/i },
  { name: 'mysql_uri', re: /mysql:\\/\\/[^\\s'"]+/i },
];
for (const p of secretPatterns) {
  if (p.re.test(content)) errors.push('Conteúdo contém possível segredo (' + p.name + '); publicação bloqueada.');
}

const knownStatuses = ['DRAFT', 'VALIDATING', 'PUBLISHED', 'ARCHIVED', 'REJECTED'];
if (status && !knownStatuses.includes(status)) {
  warnings.push("status '" + status + "' não reconhecido.");
}

return [{ json: { ok: errors.length === 0, errors, warnings } }];`,
    },
  },
  output: [{ json: { ok: true, errors: [], warnings: [] } }],
});

export default workflow('ia-validar-configuracao-prompt', 'IA - VALIDAR CONFIGURAÇÃO DO PROMPT')
  .add(trig)
  .to(carregarLimites)
  .to(validar);
