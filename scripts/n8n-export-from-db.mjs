#!/usr/bin/env node
/**
 * Export workflow JSON from n8n postgres and build tracking ops for all target IDs.
 * Usage: node scripts/n8n-export-from-db.mjs
 * Requires: pg package or uses psql via connection string from env PGURL
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
mkdirSync(wfDir, { recursive: true });
mkdirSync(opsDir, { recursive: true });

const IDS = [
  'OJZNWxBCkVXaysmf', '8EXk5RkFW5cxnenL', 'ukDndCZDzemWsOMk', 'vymsco8fVdIvgW4b',
  'vNDpCzOdR7ATnHDP', 'sofpi7zCHMCJkvfI', 'Y0MuWEEdoMFts7ay', 'WLlD1eqbFmKDK9ow',
  '0ieW448wLfITZSlD', 'T6CGZB4oxlzXlTQZ', 'ZckYIZpMtw6HEtIs', 'FaSIMuXIHeiVJe29',
  '4BnWd26yROvl0Ots', '6ZZlCncPKX4fGVmI', 'WMj1pu9mllQsZk2x', 'eyRMMc4qCzGf9naj',
  'oyTndr1NgGRbbsTt', 'a7EsJH9zcj7SMEnM', 'z63rJlQKqheFBw4u', 'gCEgRsZzch3l7mfD',
  '2cfvB59nVeJ91wii', '0S1YXMDF4gHHrTbK', 'XTEYFVPc26o3loMu', 'T7nHP1laYHDqwSPm',
  'ziXSdzv5ySslNeos', '5VMmNgSU76d9gZye', 'WCwJqtFRROwoToik', 'Oyt4aCpmjStLdYvO',
  'DYWXrIK8nGvzzWJ6',
];

const PGURL = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const idList = IDS.map((id) => `'${id}'`).join(',');

const sql = `SELECT id, name, nodes, connections, "versionId", "activeVersionId" FROM workflow_entity WHERE id IN (${idList})`;

let rows;
try {
  const out = execSync(
    `psql "${PGURL}" -t -A -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  );
  // psql -A output is pipe-delimited, but JSON in nodes has pipes - use JSON format instead
  rows = null;
} catch (_) {
  rows = null;
}

// Fallback: use psql JSON output
const jsonOut = execSync(
  `psql "${PGURL}" -t -c "SELECT json_agg(row_to_json(t)) FROM (${sql}) t"`,
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
);
rows = JSON.parse(jsonOut.trim());

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
  writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: result.ops }));

  manifest.push({
    workflowId: id,
    name: row.name,
    opCount: result.ops.length,
    note: result.note,
    skip: Boolean(result.note) || result.ops.length === 0,
  });
}

writeFileSync(join(root, 'tmp', 'n8n-batch-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
