#!/usr/bin/env node
/** Generate dollar-quoted SQL UPDATEs for merged workflow nodes */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const mergedDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-merged');
const skip = new Set(process.argv.slice(2));
const statements = [];

for (const f of readdirSync(mergedDir).filter((x) => x.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(join(mergedDir, f), 'utf8'));
  if (skip.has(data.id)) continue;
  const nodesJson = JSON.stringify(data.nodes);
  const tag = `wf_${data.id.replace(/[^a-zA-Z0-9]/g, '')}`;
  statements.push({
    id: data.id,
    name: data.name,
    sql: `UPDATE workflow_entity SET nodes = $${tag}$${nodesJson}$${tag}$::json, "updatedAt" = NOW() WHERE id = '${data.id}'`,
  });
}

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-db-updates.json'), JSON.stringify(statements, null, 2));
console.log(`Generated ${statements.length} dollar-quoted UPDATE statements`);
