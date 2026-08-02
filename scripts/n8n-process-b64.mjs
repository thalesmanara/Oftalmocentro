#!/usr/bin/env node
/** Process workflow JSON (base64 arg or file path) and write ops file */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const opsDir = join(__dirname, '..', 'tmp', 'n8n-ops');
const wfDir = join(__dirname, '..', 'tmp', 'n8n-workflows');
mkdirSync(opsDir, { recursive: true });
mkdirSync(wfDir, { recursive: true });

const arg = process.argv[2];
let raw;
if (arg.endsWith('.json') || arg.includes('/') || arg.includes('\\')) {
  raw = readFileSync(arg, 'utf8');
} else {
  raw = Buffer.from(arg, 'base64').toString('utf8');
}

const data = JSON.parse(raw);
const result = buildOps(data);
const id = data.workflow?.id || data.id;
const name = data.workflow?.name || data.name || id;

writeFileSync(join(wfDir, `${id}.json`), raw);
writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops }));

console.log(JSON.stringify({ workflowId: id, name, opCount: result.ops.length, note: result.note, skip: Boolean(result.note) || result.ops.length === 0 }));
