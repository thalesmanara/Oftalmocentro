#!/usr/bin/env node
/**
 * Apply all ops from tmp/n8n-ops/*.json - prints MCP-ready payloads for manual/agent use.
 * Does NOT call MCP itself.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPS_DIR = join(__dirname, '..', 'tmp', 'n8n-ops');
const OUT = join(__dirname, '..', 'tmp', 'n8n-apply-queue.json');

if (!existsSync(OPS_DIR)) {
  console.error('No ops dir');
  process.exit(1);
}

const queue = [];
for (const file of readdirSync(OPS_DIR).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(OPS_DIR, file), 'utf8'));
  if (data.workflowId && data.operations?.length) {
    queue.push({ workflowId: data.workflowId, operations: data.operations, opCount: data.operations.length });
  }
}

writeFileSync(OUT, JSON.stringify(queue, null, 2));
console.log(`Queued ${queue.length} workflows for apply`);
