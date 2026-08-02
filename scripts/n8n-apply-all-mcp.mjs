#!/usr/bin/env node
/** Apply all ops via n8n MCP HTTP JSON-RPC (reads ops from tmp/n8n-ops) */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const mcpUrl = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const skipIds = new Set(process.argv.slice(2));
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
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 500)}`);
  // SSE or JSON response
  const jsonLine = text.split('\n').find((l) => l.startsWith('data:'))?.slice(5).trim() || text;
  const parsed = JSON.parse(jsonLine);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  const content = parsed.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : parsed.result;
}

const results = [];
const files = readdirSync(opsDir).filter((f) => f.endsWith('.json'));

for (const f of files) {
  const { workflowId, operations } = JSON.parse(readFileSync(join(opsDir, f), 'utf8'));
  if (skipIds.has(workflowId) || operations.length === 0) {
    results.push({ workflowId, status: 'skipped', reason: operations.length === 0 ? 'no ops' : 'already done' });
    continue;
  }
  const name = JSON.parse(readFileSync(join(wfDir, `${workflowId}.json`), 'utf8')).workflow.name;
  try {
    const upd = await mcpCall('update_workflow', { workflowId, operations });
    const pub = await mcpCall('publish_workflow', { workflowId });
    results.push({
      workflowId,
      name,
      status: 'ok',
      appliedOperations: upd.appliedOperations,
      activeVersionId: pub.activeVersionId,
      opCount: operations.length,
    });
    console.log(`OK ${name} (${workflowId}) -> ${pub.activeVersionId}`);
  } catch (e) {
    results.push({ workflowId, name, status: 'error', error: e.message, opCount: operations.length });
    console.error(`FAIL ${workflowId}: ${e.message}`);
  }
}

writeFileSync(join(root, 'tmp', 'n8n-apply-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
