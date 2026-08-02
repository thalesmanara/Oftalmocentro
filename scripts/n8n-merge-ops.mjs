#!/usr/bin/env node
/** Merge tracking ops into workflow nodes JSON (for DB apply) */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const outDir = join(root, 'tmp', 'n8n-merged');
import { mkdirSync } from 'fs';
mkdirSync(outDir, { recursive: true });

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const updates = [];
for (const f of readdirSync(opsDir).filter((x) => x.endsWith('.json'))) {
  const { workflowId, operations } = JSON.parse(readFileSync(join(opsDir, f), 'utf8'));
  if (!operations.length) continue;
  const wf = JSON.parse(readFileSync(join(wfDir, `${workflowId}.json`), 'utf8')).workflow;
  const nodes = structuredClone(wf.nodes);
  for (const op of operations) {
    const node = nodes.find((n) => n.name === op.nodeName);
    if (!node) throw new Error(`${workflowId}: node ${op.nodeName} not found`);
    node.parameters = deepMerge(node.parameters || {}, op.parameters);
  }
  writeFileSync(join(outDir, `${workflowId}.json`), JSON.stringify({ id: workflowId, name: wf.name, nodes, connections: wf.connections }));
  updates.push({ workflowId, name: wf.name, nodeCount: nodes.length, opCount: operations.length });
}
writeFileSync(join(root, 'tmp', 'n8n-merge-manifest.json'), JSON.stringify(updates, null, 2));
console.log(JSON.stringify(updates, null, 2));
