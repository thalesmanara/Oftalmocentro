#!/usr/bin/env node
/**
 * Validate + create workflow from a .workflow.js file via n8n MCP HTTP.
 * Usage: node mcp-create.mjs <file.workflow.js> [description]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

const file = resolve(process.argv[2] || '');
const description = process.argv[3] || '';
const MCP_URL = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const MCP_AUTH = process.env.N8N_MCP_AUTH || process.env.CURSOR_MCP_AUTH || '';
const PROJECT_ID = 'WbvMM1wAedTR9qrk';

if (!file) {
  console.error('Usage: node mcp-create.mjs <file.workflow.js> [description]');
  process.exit(1);
}
if (!MCP_AUTH) {
  console.error('N8N_MCP_AUTH / CURSOR_MCP_AUTH required');
  process.exit(2);
}

const code = readFileSync(file, 'utf8');
const nameMatch = code.match(/workflow\([^,]+,\s*['`]([^'`]+)['`]/);
const name = nameMatch ? nameMatch[1] : basename(file, '.workflow.js');

async function mcpCall(toolName, args) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  headers.Authorization = MCP_AUTH.startsWith('Bearer ') ? MCP_AUTH : `Bearer ${MCP_AUTH}`;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // SSE style
    const lines = text.split('\n').filter((l) => l.startsWith('data: '));
    const last = lines[lines.length - 1];
    parsed = last ? JSON.parse(last.slice(6)) : { raw: text };
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 800)}`);
  if (parsed.error) throw new Error(JSON.stringify(parsed.error));
  const result = parsed.result ?? parsed;
  if (result?.isError || result?.content?.[0]?.type === 'text') {
    const t = result.content?.map((c) => c.text).join('\n') || JSON.stringify(result);
    try {
      return JSON.parse(t);
    } catch {
      return { text: t, raw: result };
    }
  }
  return result;
}

const v = await mcpCall('validate_workflow', { code });
console.log('validate', JSON.stringify(v).slice(0, 500));
if (v.valid === false || (v.errors && v.errors.length)) {
  writeFileSync(resolve(file, '..', `_validate-fail-${basename(file)}.json`), JSON.stringify(v, null, 2));
  process.exit(3);
}

const created = await mcpCall('create_workflow_from_code', {
  code,
  name,
  description: description || `Workflow ${name}`,
  projectId: PROJECT_ID,
});
console.log('created', JSON.stringify(created, null, 2));
writeFileSync(resolve(file, '..', `_created-${basename(file)}.json`), JSON.stringify(created, null, 2));
