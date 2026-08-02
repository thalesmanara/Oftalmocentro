#!/usr/bin/env node
/** Print one JSON line per workflow ops payload for MCP apply. Usage: node n8n-emit-ops-lines.mjs id1 id2 ... */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ids = process.argv.slice(2);
for (const id of ids) {
  const o = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-ops', `${id}.json`), 'utf8'));
  process.stdout.write(JSON.stringify({ workflowId: o.workflowId, operations: o.operations }) + '\n');
}
