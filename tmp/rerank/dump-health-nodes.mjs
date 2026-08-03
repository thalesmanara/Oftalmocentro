#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;

for (const name of ['Probe database', 'Prepare probes', 'Preparar probes', 'Aggregate health']) {
  const n = nodes.find((x) => x.name === name) || nodes.find((x) => x.parameters?.jsCode?.includes('retrievalDb'));
  if (!n) {
    console.log('missing', name);
    continue;
  }
  writeFileSync(new URL(`./_node-${n.name.replace(/\s+/g, '_')}.js`, import.meta.url), n.parameters.jsCode || n.parameters.query || '');
  console.log(n.name, 'type', n.type, 'codeLen', (n.parameters.jsCode || '').length, 'hasRetrieval', (n.parameters.jsCode || '').includes('retrieval'));
}

// List all code nodes
console.log(nodes.filter((n) => n.type.includes('code') || n.name.toLowerCase().includes('probe') || n.name.toLowerCase().includes('aggregat') || n.name.toLowerCase().includes('prepar')).map((n) => n.name));

await client.end();
