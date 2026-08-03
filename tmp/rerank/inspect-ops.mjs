#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const health = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof health.rows[0].nodes === 'string' ? JSON.parse(health.rows[0].nodes) : health.rows[0].nodes;
const probe = nodes.find((n) => n.name === 'Probe database');
writeFileSync(new URL('./_health-probe.sql', import.meta.url), probe?.parameters?.query || '');

const ds = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const dsn = typeof ds.rows[0].nodes === 'string' ? JSON.parse(ds.rows[0].nodes) : ds.rows[0].nodes;
const insert = dsn.find((n) => String(n.parameters?.query || '').includes('INSERT INTO ai_test_runs'));
writeFileSync(new URL('./_dataset-insert.sql', import.meta.url), insert?.parameters?.query || 'NONE');

console.log('probe has retrieval_stats', probe?.parameters?.query?.includes('retrieval_stats'));
console.log('probe has CROSS JOIN retrieval_stats', probe?.parameters?.query?.includes('CROSS JOIN retrieval_stats'));
console.log('dataset has retrieval_config_version', insert?.parameters?.query?.includes('retrieval_config_version'));
await client.end();
