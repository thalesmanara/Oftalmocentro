#!/usr/bin/env node
/**
 * Loop: read ops file, call update_workflow + publish_workflow through injected handler.
 * Usage: node scripts/n8n-apply-loop.mjs <workflowId> [--dry-run]
 * Emits JSON: { workflowId, operations, action: 'update'|'publish' }
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const id = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!id) {
  console.error('Usage: node n8n-apply-loop.mjs <workflowId>');
  process.exit(1);
}

const ops = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-ops', `${id}.json`), 'utf8'));
if (dry) {
  console.log(JSON.stringify({ workflowId: id, opCount: ops.operations.length }));
} else {
  console.log(JSON.stringify({ phase: 'update', workflowId: ops.workflowId, operations: ops.operations }));
}
