#!/usr/bin/env node
/** Process postgres export JSON and build ops for all workflows */
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

const exportPath = process.argv[2] || join(root, 'tmp', 'n8n-db-export.json');
const raw = JSON.parse(readFileSync(exportPath, 'utf8'));
const rows = Array.isArray(raw) && raw[0]?.json_agg ? raw[0].json_agg : raw;

const manifest = [];

for (const row of rows) {
  const id = row.id;
  const payload = {
    workflow: {
      id: row.id,
      name: row.name,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      connections: typeof row.connections === 'string' ? JSON.parse(row.connections) : row.connections,
      versionId: row.versionId,
      activeVersionId: row.activeVersionId,
    },
  };
  writeFileSync(join(wfDir, `${id}.json`), JSON.stringify(payload));
  const result = buildOps(payload);
  writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops, note: result.note }));

  manifest.push({
    workflowId: id,
    name: row.name,
    opCount: result.ops.length,
    note: result.note || null,
    skip: Boolean(result.note) || result.ops.length === 0,
  });
}

writeFileSync(join(root, 'tmp', 'n8n-batch-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
