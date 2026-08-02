#!/usr/bin/env node
/**
 * Generate ops for all workflow JSONs and write apply queue.
 * Usage: node scripts/n8n-generate-all-ops.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
const queuePath = join(root, 'tmp', 'n8n-apply-queue.json');
mkdirSync(opsDir, { recursive: true });

const SKIP = new Set([
  'N3zLpj7Dij4n5p5p', 'zE5LRjZfbXw8Ymll', 'r3iSBV1ClKOxS2UI',
  'P5E43ZXSJiI9wFYD', 'yXW3rW8EbHXuprRJ', 'FJRbZWYX2pokOa0m',
]);

const ALREADY = new Set([
  'pkQiNqpkrRgSM4Wa', // confirmed updated in n8n
]);

const queue = [];

for (const f of readdirSync(wfDir).filter((x) => x.endsWith('.json'))) {
  const id = f.replace('.json', '');
  if (SKIP.has(id)) continue;
  const data = JSON.parse(readFileSync(join(wfDir, f), 'utf8'));
  const result = buildOps(data);
  const name = data.workflow?.name || data.name || id;
  if (result.note) {
    queue.push({ workflowId: id, name, status: 'skipped', note: result.note });
    continue;
  }
  if (!result.ops.length) {
    queue.push({ workflowId: id, name, status: 'skipped', note: 'No ops (already updated?)' });
    continue;
  }
  writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops }));
  queue.push({
    workflowId: id,
    name,
    status: ALREADY.has(id) ? 'already_done' : 'pending',
    opCount: result.ops.length,
  });
}

writeFileSync(queuePath, JSON.stringify(queue, null, 2));
console.log(JSON.stringify(queue, null, 2));
