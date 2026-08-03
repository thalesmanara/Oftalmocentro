#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function getQuery(wfId, nodeName) {
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [wfId]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === nodeName);
  return n?.parameters?.query || null;
}

const out = {
  create: await getQuery('RjQDc5gcWFYyBQJO', 'Inserir DRAFT'),
  updateCheck: await getQuery('Ci5BcAlkZCxOxdyA', 'Checar status DRAFT'),
  datasetInsert: await getQuery('12t0Ol6zWQJgAKPC', 'Inserir run'),
  loadCfg: await getQuery('sClDEVNVS0TGG2uq', 'Buscar config'),
};

// Verify no remaining '={{
const remaining = {};
for (const [k, q] of Object.entries(out)) {
  remaining[k] = {
    hasBad: q?.includes("'={{") || false,
    startsWithEq: q?.startsWith('=') || false,
    hasGood: q?.includes("'{{") || false,
  };
}

writeFileSync(new URL('./_verify-queries.json', import.meta.url), JSON.stringify({ remaining, out }, null, 2));
console.log(JSON.stringify(remaining, null, 2));
await client.end();
