#!/usr/bin/env node
/**
 * Apply all pending workflow updates via n8n MCP using @modelcontextprotocol/sdk over HTTP.
 * Requires MCP auth token in N8N_MCP_AUTH or Cursor session - falls back to printing instructions.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const queuePath = join(root, 'tmp', 'n8n-apply-queue.json');
const resultsPath = join(root, 'tmp', 'n8n-apply-results.json');
mkdirSync(join(root, 'tmp'), { recursive: true });

const MCP_URL = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const MCP_AUTH = process.env.N8N_MCP_AUTH || process.env.CURSOR_MCP_AUTH || '';

async function mcpCall(toolName, args) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (MCP_AUTH) headers.Authorization = MCP_AUTH.startsWith('Bearer ') ? MCP_AUTH : `Bearer ${MCP_AUTH}`;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  if (!res.ok) throw new Error(`MCP ${toolName} HTTP ${res.status}: ${text.slice(0, 500)}`);
  if (parsed.error) throw new Error(`MCP ${toolName}: ${JSON.stringify(parsed.error)}`);
  return parsed.result ?? parsed;
}

const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const pending = queue.filter((q) => q.status === 'pending');
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
const done = new Set(results.filter((r) => r.status === 'ok').map((r) => r.workflowId));

if (!MCP_AUTH) {
  console.error('Set N8N_MCP_AUTH to run automated MCP apply.');
  process.exit(1);
}

for (const q of pending) {
  if (done.has(q.workflowId)) continue;
  const entry = { workflowId: q.workflowId, name: q.name, status: 'failed' };
  try {
    const opsFile = join(opsDir, `${q.workflowId}.json`);
    const { workflowId, operations } = JSON.parse(readFileSync(opsFile, 'utf8'));
    const upd = await mcpCall('update_workflow', { workflowId, operations });
    const pub = await mcpCall('publish_workflow', { workflowId });
    entry.status = 'ok';
    entry.appliedOperations = upd?.appliedOperations ?? operations.length;
    entry.versionId = pub?.activeVersionId ?? pub?.versionId ?? null;
  } catch (err) {
    entry.error = String(err.message || err);
  }
  results.push(entry);
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(entry));
}
