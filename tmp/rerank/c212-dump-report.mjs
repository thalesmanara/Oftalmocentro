#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const n of nodes) {
  if (/relat[oó]rio|Gerar/i.test(n.name)) {
    writeFileSync(
      new URL(`./_c212-ds-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
      n.parameters?.jsCode || n.parameters?.query || JSON.stringify(n.parameters, null, 2),
    );
    console.log(n.name, n.type, (n.parameters?.jsCode || '').length);
  }
  if (/Carregar resultados/i.test(n.name)) {
    writeFileSync(
      new URL(`./_c212-ds-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
      n.parameters?.query || n.parameters?.jsCode || '',
    );
    console.log(n.name, (n.parameters?.query || '').slice(0, 300));
  }
}

// Check if report column update sets status
const blob = nodes.map((n) => (n.parameters?.jsCode || '') + (n.parameters?.query || '')).join('\n---\n');
const idxs = [];
let i = 0;
while ((i = blob.indexOf('FAILED', i)) >= 0) {
  idxs.push(blob.slice(Math.max(0, i - 80), i + 80));
  i += 6;
}
console.log('FAILED contexts', idxs.length);
for (const s of idxs) console.log('---\n', s);

await client.end();
