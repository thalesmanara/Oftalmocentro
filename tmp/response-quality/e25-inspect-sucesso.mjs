#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT name, nodes FROM workflow_entity WHERE id='zE5LRjZfbXw8Ymll'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
console.log(
  'nodes',
  nodes.map((n) => n.name),
);
for (const n of nodes) {
  const code = n.parameters?.jsCode || n.parameters?.query || '';
  if (/audit|action/i.test(String(code)) || /audit|action/i.test(n.name)) {
    console.log('\n===', n.name, '===');
    console.log(String(code).slice(0, 1500));
  }
}
// also check trigger/webhook inputs
const start = nodes.find((n) => n.type?.includes('executeWorkflowTrigger') || n.name?.includes('Trigger'));
console.log('\ntrigger params', JSON.stringify(start?.parameters || {}, null, 2).slice(0, 2000));

await c.end();
