import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const mcpUrl = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const PROJECT_ID = 'WbvMM1wAedTR9qrk';
const PG_CRED_ID = 'XJtGZ5rpCR7BpN0X';
const PG_CRED_NAME = 'Postgres account';
const code = readFileSync(join(dir, 'auth-change-password.workflow.js'), 'utf8');

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
  let parsed;
  if (text.includes('data:')) {
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    parsed = JSON.parse(dataLines[dataLines.length - 1]);
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

const v = await mcpCall('validate_workflow', { code });
console.log('validate', JSON.stringify(v, null, 2).slice(0, 3000));
if (v.valid === false || (v.errors && v.errors.length)) {
  writeFileSync(join(dir, 'change-password-result.json'), JSON.stringify(v, null, 2));
  process.exit(1);
}

const created = await mcpCall('create_workflow_from_code', {
  code,
  name: 'AUTH - CHANGE PASSWORD',
  description: 'POST /webhook/auth/change-password — usuário autenticado troca a própria senha com verificação da senha atual.',
  projectId: PROJECT_ID,
});
const workflowId = created.workflowId || created.id || created.workflow?.id;
console.log('created', workflowId, created.targetProject || '');
if (!workflowId) {
  writeFileSync(join(dir, 'change-password-result.json'), JSON.stringify(created, null, 2));
  process.exit(1);
}

await mcpCall('update_workflow', {
  workflowId,
  operations: [
    {
      type: 'setNodeCredential',
      nodeName: 'Atualizar senha',
      credentialKey: 'postgres',
      credentialId: PG_CRED_ID,
      credentialName: PG_CRED_NAME,
    },
  ],
});
console.log('credential set');

const pub = await mcpCall('publish_workflow', { workflowId });
const out = { workflowId, published: pub, created };
writeFileSync(join(dir, 'change-password-result.json'), JSON.stringify(out, null, 2));
console.log('published', pub.activeVersionId || pub.versionId || pub);
