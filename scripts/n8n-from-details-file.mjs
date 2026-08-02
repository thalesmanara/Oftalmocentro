#!/usr/bin/env node
/** Extract minimal workflow {id,name,nodes:name+parameters} from get_workflow_details JSON */
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

const inFile = process.argv[2];
const raw = readFileSync(inFile, 'utf8');
const data = JSON.parse(raw);
const wf = data.workflow || data;
const minimal = {
  workflow: {
    id: wf.id,
    name: wf.name,
    nodes: (wf.nodes || []).map((n) => ({ name: n.name, parameters: n.parameters || {} })),
  },
};
const minRaw = JSON.stringify(minimal);
writeFileSync(join(wfDir, `${wf.id}.json`), minRaw);
const result = buildOps(minimal);
writeFileSync(join(opsDir, `${wf.id}.json`), JSON.stringify({ workflowId: wf.id, operations: result.ops }));
console.log(JSON.stringify({ workflowId: wf.id, name: wf.name, opCount: result.ops.length, note: result.note }));
