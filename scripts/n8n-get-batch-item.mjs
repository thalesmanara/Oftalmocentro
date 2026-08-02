#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const idx = Number(process.argv[2] ?? 0);
const batch = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-mcp-batch.json'), 'utf8'));
const item = batch[idx];
if (!item) { console.error('No item at index', idx); process.exit(1); }
console.log(JSON.stringify({ workflowId: item.workflowId, name: item.name, operations: item.operations }));
