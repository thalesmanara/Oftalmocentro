#!/usr/bin/env node
/** Apply merged node updates to n8n DB via pg, then list IDs to publish */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const updates = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-db-updates.json'), 'utf8'));
const skip = new Set(process.argv.slice(2));
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const client = new pg.Client({ connectionString: conn });
await client.connect();

const results = [];
for (const row of updates) {
  if (skip.has(row.id)) continue;
  try {
    const res = await client.query(row.sql);
    results.push({ workflowId: row.id, name: row.name, status: 'updated', rowCount: res.rowCount });
    console.log(`UPDATED ${row.name} (${row.id})`);
  } catch (e) {
    results.push({ workflowId: row.id, name: row.name, status: 'error', error: e.message });
    console.error(`FAIL ${row.id}: ${e.message}`);
  }
}
await client.end();
writeFileSync(join(root, 'tmp', 'n8n-db-apply-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
