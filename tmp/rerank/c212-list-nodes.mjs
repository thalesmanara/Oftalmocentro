#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Dump full EXECUTAR DATASET node names + connections summary
for (const id of ['12t0Ol6zWQJgAKPC', 'KdpEmEGHNlPICOa4']) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\n===', rows[0].name, '===');
  console.log(nodes.map((n) => n.name).join(' → '));
  writeFileSync(
    new URL(`./_c212-wf-${id}-names.json`, import.meta.url),
    JSON.stringify(nodes.map((n) => n.name), null, 2),
  );
}

// Sample execution of Calcular métricas output shape from a recent parent
const exec = await client.query(
  `SELECT id FROM execution_entity WHERE "workflowId"='12t0Ol6zWQJgAKPC' AND status='success' ORDER BY "startedAt" DESC LIMIT 1`,
);
console.log('sample dataset exec', exec.rows[0]);

await client.end();
