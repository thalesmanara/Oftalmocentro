#!/usr/bin/env node
/** Sync merged nodes to workflow_entity + active workflow_history, then publish via instructions */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { randomUUID } from 'crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = [
  'WCwJqtFRROwoToik', 'XTEYFVPc26o3loMu', 'OJZNWxBCkVXaysmf', 'sofpi7zCHMCJkvfI',
  'ukDndCZDzemWsOMk', 'vNDpCzOdR7ATnHDP', 'vymsco8fVdIvgW4b', 'gCEgRsZzch3l7mfD',
];
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

const results = [];
for (const id of IDS) {
  const merged = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-merged', `${id}.json`), 'utf8'));
  const { rows } = await client.query(
    `SELECT "versionId", "activeVersionId", connections, name FROM workflow_entity WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  const nodesJson = JSON.stringify(merged.nodes);
  const newVersionId = randomUUID();
  await client.query(
    `UPDATE workflow_entity SET nodes = $1::json, "versionId" = $2, "updatedAt" = NOW() WHERE id = $3`,
    [nodesJson, newVersionId, id]
  );
  await client.query(
    `UPDATE workflow_history SET nodes = $1::json, "updatedAt" = NOW() WHERE "workflowId" = $2 AND "versionId" = $3`,
    [nodesJson, id, row.activeVersionId]
  );
  results.push({ id, name: merged.name, newVersionId, prevActiveVersionId: row.activeVersionId });
  console.log(`SYNCED ${merged.name} draft+history -> ${newVersionId}`);
}
await client.end();
writeFileSync(join(root, 'tmp', 'n8n-sync-publish-queue.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
