#!/usr/bin/env node
/** Save get_workflow_details JSON from stdin/file, generate ops */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
mkdirSync(wfDir, { recursive: true });
mkdirSync(opsDir, { recursive: true });

const raw = process.argv[2]
  ? readFileSync(process.argv[2], 'utf8')
  : readFileSync(0, 'utf8');
const data = JSON.parse(raw);
const id = data.workflow?.id || data.id;
const name = data.workflow?.name || data.name || id;
writeFileSync(join(wfDir, `${id}.json`), raw);
const result = buildOps(data);
writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops }));
console.log(JSON.stringify({ workflowId: id, name, opCount: result.ops.length, note: result.note }));
