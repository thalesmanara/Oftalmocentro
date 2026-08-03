/**
 * Validate + create + credential + publish all 6 AI prompt admin webhooks via n8n MCP HTTP.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const mcpUrl = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const PROJECT_ID = 'WbvMM1wAedTR9qrk';
const PG_CRED_ID = 'XJtGZ5rpCR7BpN0X';
const PG_CRED_NAME = 'Postgres account';

let reqId = 1;

async function mcpCall(toolName, args) {
  const body = {
    jsonrpc: '2.0',
    id: reqId++,
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 800)}`);
  // Handle SSE
  let parsed;
  if (text.includes('data:')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    const last = dataLines[dataLines.length - 1];
    parsed = JSON.parse(last);
  } else {
    parsed = JSON.parse(text);
  }
  if (parsed.error) throw new Error(`${toolName}: ${JSON.stringify(parsed.error)}`);
  const content = parsed.result?.content?.[0]?.text;
  if (content) {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content, result: parsed.result };
    }
  }
  return parsed.result ?? parsed;
}

const workflows = [
  {
    file: 'post-ai-prompts-create.workflow.js',
    name: 'POST System AI Prompts Create',
    description:
      'POST /webhook/system/ai-prompts/create — cria versão DRAFT (max+1), hash sha256 no Code, auditoria AI_PROMPT_DRAFT_CREATE.',
    pgNodes: ['Carregar contexto', 'Executar criação'],
  },
  {
    file: 'put-ai-prompts-update.workflow.js',
    name: 'PUT System AI Prompts Update',
    description:
      'PUT /webhook/system/ai-prompts/update — atualiza DRAFT only; rejeita PUBLISHED com 400; auditoria AI_PROMPT_DRAFT_UPDATE.',
    pgNodes: ['Carregar contexto', 'Executar atualização'],
  },
  {
    file: 'post-ai-prompts-validate.workflow.js',
    name: 'POST System AI Prompts Validate',
    description:
      'POST /webhook/system/ai-prompts/validate — chama VALIDAR, marca VALIDATING, audits START/FINISH.',
    pgNodes: ['Carregar contexto', 'Marcar VALIDATING', 'Atualizar status final'],
  },
  {
    file: 'post-ai-prompts-publish.workflow.js',
    name: 'POST System AI Prompts Publish',
    description:
      'POST /webhook/system/ai-prompts/publish — chama PUBLICAR com forceOverride; audit PUBLISH ou PUBLISH_OVERRIDE.',
    pgNodes: [],
  },
  {
    file: 'post-ai-prompts-rollback.workflow.js',
    name: 'POST System AI Prompts Rollback',
    description: 'POST /webhook/system/ai-prompts/rollback — chama ROLLBACK; auditoria AI_PROMPT_ROLLBACK.',
    pgNodes: [],
  },
  {
    file: 'get-ai-prompts-compare.workflow.js',
    name: 'GET System AI Prompts Compare',
    description: 'GET /webhook/system/ai-prompts/compare — chama COMPARAR; sem auditoria.',
    pgNodes: [],
  },
];

const results = [];

for (const wf of workflows) {
  const code = readFileSync(join(dir, wf.file), 'utf8');
  const entry = { file: wf.file, name: wf.name, status: 'pending' };
  try {
    console.log(`\n=== Validating ${wf.name} ===`);
    const v = await mcpCall('validate_workflow', { code });
    if (v.valid === false || (v.errors && v.errors.length)) {
      entry.status = 'validate_failed';
      entry.errors = v.errors || v;
      console.error('VALIDATE FAIL', JSON.stringify(v, null, 2).slice(0, 2000));
      results.push(entry);
      continue;
    }
    console.log('valid OK');

    console.log(`Creating ${wf.name}...`);
    const created = await mcpCall('create_workflow_from_code', {
      code,
      name: wf.name,
      description: wf.description,
      projectId: PROJECT_ID,
    });
    const workflowId = created.workflowId || created.id || created.workflow?.id;
    if (!workflowId) {
      entry.status = 'create_failed';
      entry.response = created;
      console.error('CREATE FAIL', JSON.stringify(created).slice(0, 1500));
      results.push(entry);
      continue;
    }
    entry.workflowId = workflowId;
    console.log('created', workflowId);

    for (const nodeName of wf.pgNodes) {
      console.log(`  setNodeCredential ${nodeName}`);
      await mcpCall('update_workflow', {
        workflowId,
        operations: [
          {
            type: 'setNodeCredential',
            nodeName,
            credentialKey: 'postgres',
            credentialId: PG_CRED_ID,
            credentialName: PG_CRED_NAME,
          },
        ],
      });
    }

    console.log('Publishing...');
    const pub = await mcpCall('publish_workflow', { workflowId });
    entry.activeVersionId = pub.activeVersionId || pub.versionId || null;
    entry.status = 'ok';
    console.log('published', entry.activeVersionId);
  } catch (e) {
    entry.status = 'error';
    entry.error = String(e.message || e);
    console.error('ERROR', entry.error);
  }
  results.push(entry);
  writeFileSync(join(dir, 'mcp-create-results.json'), JSON.stringify(results, null, 2));
}

writeFileSync(join(dir, 'mcp-create-results.json'), JSON.stringify(results, null, 2));
console.log('\n=== DONE ===');
console.log(JSON.stringify(results, null, 2));
