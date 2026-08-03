#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

for (const id of ['5fbdabb413c3405d', '68acc8f5d57d4fac', '5b6dcd491b8d449e']) {
  const { rows } = await client.query(`SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\n===', rows[0].name, '===');
  for (const n of nodes) {
    const t = n.type || '';
    if (/respond|code|postgres|webhook/i.test(t) || /respond|montar|criar|insert|erro|sucesso/i.test(n.name || '')) {
      console.log('-', n.name, t);
      if (n.parameters?.jsCode) {
        console.log('  code head:', n.parameters.jsCode.slice(0, 200).replace(/\n/g, ' '));
      }
      if (n.parameters?.options || n.parameters?.responseBody || n.parameters?.respondWith) {
        console.log('  respond params', JSON.stringify({
          respondWith: n.parameters.respondWith,
          responseBody: String(n.parameters.responseBody || '').slice(0, 200),
          options: n.parameters.options,
        }).slice(0, 300));
      }
    }
  }
  writeFileSync(new URL(`./_c211-wf-${id}.json`, import.meta.url), JSON.stringify({ name: rows[0].name, nodes, connections: rows[0].connections }, null, 2));
}

// Check recent CREATE executions
const ex = await client.query(
  `SELECT id, status, "startedAt" FROM execution_entity WHERE "workflowId"='5fbdabb413c3405d' ORDER BY "startedAt" DESC LIMIT 5`,
);
console.log('create execs', ex.rows);

await client.end();
