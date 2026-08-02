#!/usr/bin/env node
/** Read ops file and print JSON for MCP update_workflow arguments */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const id = process.argv[2];
if (!id) { console.error('Usage: node n8n-read-ops.mjs <workflowId>'); process.exit(1); }
const data = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-ops', `${id}.json`), 'utf8'));
process.stdout.write(JSON.stringify({ workflowId: data.workflowId, operations: data.operations }));
