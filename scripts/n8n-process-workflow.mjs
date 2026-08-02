#!/usr/bin/env node
/** Build ops from saved workflow JSON; print summary JSON to stdout */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const opsDir = join(__dirname, '..', 'tmp', 'n8n-ops');
mkdirSync(opsDir, { recursive: true });

const file = process.argv[2];
const data = JSON.parse(readFileSync(file, 'utf8'));
const result = buildOps(data);
const id = data.workflow?.id || data.id;
const name = data.workflow?.name || data.name || id;

writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops }));

const summary = { workflowId: id, name, opCount: result.ops.length, note: result.note, skip: Boolean(result.note) || result.ops.length === 0 };
console.log(JSON.stringify(summary));
