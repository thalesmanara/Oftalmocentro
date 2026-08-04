#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='c22CacheList0000001'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const name of ['Restaurar request', 'SQL', 'Montar data', 'Preparar sucesso']) {
  const n = nodes.find((x) => x.name === name);
  console.log('\n====', name, n?.type);
  console.log((n?.parameters?.jsCode || n?.parameters?.query || '').slice(0, 600));
}
await c.end();
