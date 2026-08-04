#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='P5E43ZXSJiI9wFYD'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const n of nodes) {
  console.log(n.name, n.type, Object.keys(n.parameters || {}));
  if (n.parameters?.assignments || n.parameters?.values) {
    console.log('  assignments', JSON.stringify(n.parameters.assignments || n.parameters.values).slice(0, 200));
  }
}
await c.end();
