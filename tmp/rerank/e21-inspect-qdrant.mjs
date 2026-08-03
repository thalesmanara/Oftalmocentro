#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='YDnrXjzYUOrZVE6N'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const summary = nodes.map((n) => ({
  name: n.name,
  type: n.type,
  params: n.type.includes('code')
    ? (n.parameters?.jsCode || '').slice(0, 400)
    : JSON.stringify(n.parameters || {}).slice(0, 400),
}));
writeFileSync(new URL('./_e21-qdrant-wf.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log(summary.map((s) => s.name).join('\n'));
await client.end();
