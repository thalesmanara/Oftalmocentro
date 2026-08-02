#!/usr/bin/env node
/** Write MCP-ready payload files from ops */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const outDir = join(root, 'tmp', 'n8n-mcp-payload');
mkdirSync(outDir, { recursive: true });

const skip = new Set(process.argv.slice(2));
for (const f of readdirSync(opsDir).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(opsDir, f), 'utf8'));
  if (skip.has(data.workflowId) || !data.operations.length) continue;
  writeFileSync(join(outDir, `${data.workflowId}.json`), JSON.stringify({
    workflowId: data.workflowId,
    operations: data.operations,
  }));
}
console.log('Wrote payloads to', outDir);
