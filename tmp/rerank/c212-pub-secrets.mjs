#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['f83073bfb4154115', '708bf587fb73467f']) {
  const { rows } = await c.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\n===', rows[0].name, '===');
  for (const n of nodes) {
    const blob = JSON.stringify(n.parameters || {});
    if (/app_secrets|context_active|INSERT INTO app_secrets|UPSERT/i.test(blob + (n.parameters?.jsCode || '') + (n.parameters?.query || ''))) {
      console.log(n.name, (n.parameters?.query || n.parameters?.jsCode || '').slice(0, 500));
    }
  }
}
await c.end();
