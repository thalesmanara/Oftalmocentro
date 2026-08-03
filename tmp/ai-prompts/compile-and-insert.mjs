/**
 * Compile SDK workflow sources to n8n JSON, insert via pg, leave inactive for MCP publish.
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import crypto from 'crypto';
import pg from 'pg';

const dir = dirname(fileURLToPath(import.meta.url));
const PROJECT_ID = 'WbvMM1wAedTR9qrk';
const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const CONN =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

function nanoid(size = 16) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(size);
  let id = '';
  for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
  return id;
}

const workflows = [
  {
    file: 'post-ai-prompts-create.workflow.js',
    name: 'POST System AI Prompts Create',
    description:
      'POST /webhook/system/ai-prompts/create — cria versão DRAFT (max+1), hash sha256 no Code, auditoria AI_PROMPT_DRAFT_CREATE.',
  },
  {
    file: 'put-ai-prompts-update.workflow.js',
    name: 'PUT System AI Prompts Update',
    description:
      'PUT /webhook/system/ai-prompts/update — atualiza DRAFT only; rejeita PUBLISHED com 400; auditoria AI_PROMPT_DRAFT_UPDATE.',
  },
  {
    file: 'post-ai-prompts-validate.workflow.js',
    name: 'POST System AI Prompts Validate',
    description:
      'POST /webhook/system/ai-prompts/validate — chama VALIDAR, marca VALIDATING, audits START/FINISH.',
  },
  {
    file: 'post-ai-prompts-publish.workflow.js',
    name: 'POST System AI Prompts Publish',
    description:
      'POST /webhook/system/ai-prompts/publish — chama PUBLICAR com forceOverride; audit PUBLISH ou PUBLISH_OVERRIDE.',
  },
  {
    file: 'post-ai-prompts-rollback.workflow.js',
    name: 'POST System AI Prompts Rollback',
    description: 'POST /webhook/system/ai-prompts/rollback — chama ROLLBACK; auditoria AI_PROMPT_ROLLBACK.',
  },
];

const client = new pg.Client({ connectionString: CONN });
await client.connect();

const results = [];

for (const wf of workflows) {
  const mod = await import(pathToFileURL(join(dir, wf.file)).href + `?t=${Date.now()}`);
  const compiled = mod.default.toJSON();
  // Attach postgres credentials
  for (const n of compiled.nodes) {
    if (n.type === 'n8n-nodes-base.postgres') {
      n.credentials = { postgres: PG_CRED };
    }
    // ensure webhookId
    if (n.type === 'n8n-nodes-base.webhook' && !n.webhookId) {
      n.webhookId = crypto.randomUUID();
    }
  }

  const workflowId = nanoid(16);
  const versionId = crypto.randomUUID();
  const nodes = compiled.nodes;
  const connections = compiled.connections;
  const settings = { executionOrder: 'v1', availableInMCP: true, ...(compiled.settings || {}) };
  const meta = { aiBuilderAssisted: true, builderVariant: 'local-sdk-compile' };

  // Check name collision
  const { rows: existing } = await client.query(`SELECT id FROM workflow_entity WHERE name = $1`, [wf.name]);
  if (existing.length) {
    results.push({ file: wf.file, name: wf.name, status: 'exists', workflowId: existing[0].id });
    console.log('EXISTS', wf.name, existing[0].id);
    continue;
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO workflow_entity (
        id, name, active, nodes, connections, settings, "staticData", "pinData",
        "versionId", "triggerCount", meta, "parentFolderId", "isArchived",
        "versionCounter", description, "activeVersionId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, false, $3::json, $4::json, $5::json, NULL, '{}'::json,
        $6, 0, $7::json, NULL, false,
        1, $8, NULL, NOW(), NOW()
      )`,
      [
        workflowId,
        wf.name,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        JSON.stringify(settings),
        versionId,
        JSON.stringify(meta),
        wf.description,
      ]
    );

    await client.query(
      `INSERT INTO shared_workflow ("workflowId", "projectId", role, "createdAt", "updatedAt")
       VALUES ($1, $2, 'workflow:owner', NOW(), NOW())`,
      [workflowId, PROJECT_ID]
    );

    await client.query(
      `INSERT INTO workflow_history (
        "versionId", "workflowId", authors, nodes, connections, name, description, autosaved, "nodeGroups", "createdAt", "updatedAt"
      ) VALUES ($1, $2, 'mcp-local', $3::json, $4::json, $5, $6, false, '[]'::json, NOW(), NOW())`,
      [versionId, workflowId, JSON.stringify(nodes), JSON.stringify(connections), wf.name, wf.description]
    );

    await client.query('COMMIT');
    results.push({
      file: wf.file,
      name: wf.name,
      status: 'inserted',
      workflowId,
      versionId,
      nodeCount: nodes.length,
      pgNodes: nodes.filter((n) => n.type === 'n8n-nodes-base.postgres').map((n) => n.name),
    });
    console.log('INSERTED', wf.name, workflowId, 'nodes', nodes.length);
  } catch (e) {
    await client.query('ROLLBACK');
    results.push({ file: wf.file, name: wf.name, status: 'error', error: String(e.message || e) });
    console.error('FAIL', wf.name, e.message);
  }
}

await client.end();
writeFileSync(join(dir, 'insert-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
