#!/usr/bin/env node
/** Print update_workflow MCP args from tmp/mcp_apply_<id>.json */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node n8n-mcp-apply-one-from-file.mjs <workflowId>');
  process.exit(1);
}
const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', `mcp_apply_${id}.json`);
const data = JSON.parse(readFileSync(path, 'utf8'));
process.stdout.write(JSON.stringify({ workflowId: data.workflowId, operations: data.operations }));
