#!/usr/bin/env node
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const sql = readFileSync(new URL('./_c212-probe-db.sql', import.meta.url), 'utf8');
console.log('tail:\n', sql.slice(-2000));

const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const n of nodes) {
  if (n.parameters?.jsCode && /retrievalDb|aiEvalDb|_partial/i.test(n.parameters.jsCode)) {
    console.log('\nMAPPER', n.name);
    writeFileSync(new URL(`./_c212-hmap-${n.name.replace(/\W+/g, '_')}.js`, import.meta.url), n.parameters.jsCode);
  }
}
await client.end();
