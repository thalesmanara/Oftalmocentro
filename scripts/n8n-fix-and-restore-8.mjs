#!/usr/bin/env node
/** Restore full nodes from n8n-db-export + merge ops for 8 corrupted workflows */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = [
  'WCwJqtFRROwoToik',
  'XTEYFVPc26o3loMu',
  'OJZNWxBCkVXaysmf',
  'sofpi7zCHMCJkvfI',
  'ukDndCZDzemWsOMk',
  'vNDpCzOdR7ATnHDP',
  'vymsco8fVdIvgW4b',
  'gCEgRsZzch3l7mfD',
];

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === 'object' &&
      !Array.isArray(target[k])
    ) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const exportData = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-db-export.json'), 'utf8'));
const workflows = exportData[0]?.json_agg ?? exportData;
const byId = new Map(workflows.map((w) => [w.id, w]));

const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

const results = [];
for (const id of IDS) {
  const base = byId.get(id);
  if (!base) {
    results.push({ id, status: 'error', error: 'not in db export' });
    continue;
  }
  const opsFile = join(root, 'tmp', 'n8n-ops', `${id}.json`);
  const { operations } = JSON.parse(readFileSync(opsFile, 'utf8'));
  const nodes = structuredClone(base.nodes);
  for (const op of operations) {
    if (op.type !== 'updateNodeParameters') continue;
    const node = nodes.find((n) => n.name === op.nodeName);
    if (!node) throw new Error(`${id}: node ${op.nodeName} not found`);
    node.parameters = deepMerge(node.parameters || {}, op.parameters);
  }
  const missingType = nodes.filter((n) => !n.type);
  if (missingType.length) {
    results.push({ id, status: 'error', error: `${missingType.length} nodes still missing type` });
    continue;
  }
  await client.query(
    `UPDATE workflow_entity SET nodes = $1::json, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify(nodes), id]
  );
  writeFileSync(join(root, 'tmp', 'n8n-merged', `${id}.json`), JSON.stringify({ id, name: base.name, nodes, connections: base.connections }, null, 2));
  results.push({ id, name: base.name, status: 'restored', nodeCount: nodes.length, opCount: operations.length });
  console.log(`RESTORED ${base.name} (${id})`);
}

await client.end();
writeFileSync(join(root, 'tmp', 'n8n-fix-8-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
