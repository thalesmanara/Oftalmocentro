#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='c22CacheList0000001'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const n of nodes.slice(0, 6)) {
  console.log('---', n.name, n.type);
  if (n.name === 'Validar auth' || n.name === 'Auth ok?' || n.name?.includes('Permiss')) {
    console.log(JSON.stringify(n.parameters, null, 2).slice(0, 800));
  }
}
await c.end();
