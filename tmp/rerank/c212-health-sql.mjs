#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const probe = nodes.find((n) => n.name === 'Probe database');
writeFileSync(new URL('./_c212-probe-db.sql', import.meta.url), probe?.parameters?.query || '');
console.log('Probe database query len', (probe?.parameters?.query || '').length);
console.log((probe?.parameters?.query || '').slice(0, 1500));

const fin = nodes.find((n) => n.name === 'Finalize storage');
writeFileSync(new URL('./_c212-finalize-storage.js', import.meta.url), fin?.parameters?.jsCode || '');
console.log('\nFinalize storage:\n', fin?.parameters?.jsCode?.slice(0, 800));

const prep = nodes.find((n) => n.name === 'Prepare checks');
console.log('\nPrepare checks has context', prep?.parameters?.jsCode?.includes('context'));

await client.end();
