#!/usr/bin/env node
/** Export all pending MCP update_workflow payloads to tmp/n8n-mcp-batch.json */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const queue = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-apply-queue.json'), 'utf8'));
const pending = queue.filter((q) => q.status === 'pending');
const batch = [];

for (const q of pending) {
  const f = join(root, 'tmp', 'n8n-ops', `${q.workflowId}.json`);
  if (!existsSync(f)) continue;
  const { workflowId, operations } = JSON.parse(readFileSync(f, 'utf8'));
  batch.push({ workflowId, name: q.name, operations });
}

writeFileSync(join(root, 'tmp', 'n8n-mcp-batch.json'), JSON.stringify(batch, null, 2));
console.log(JSON.stringify({ count: batch.length, ids: batch.map((b) => b.workflowId) }));
