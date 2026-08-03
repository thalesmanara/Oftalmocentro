#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const id = '1uITQcJ5jSNXErOM';
const { rows } = await client.query(
  `SELECT id, name, nodes, connections, active, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [id],
);
console.log(rows[0]?.name, rows[0]?.active);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
writeFileSync(
  new URL('./_c212-calcular-nodes.json', import.meta.url),
  JSON.stringify(
    nodes.map((n) => ({ name: n.name, type: n.type, params: Object.keys(n.parameters || {}) })),
    null,
    2,
  ),
);

for (const n of nodes) {
  if (n.parameters?.jsCode) {
    writeFileSync(
      new URL(`./_c212-calc-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.js`, import.meta.url),
      n.parameters.jsCode,
    );
    console.log('code', n.name, n.parameters.jsCode.length);
  }
  if (n.parameters?.query) {
    writeFileSync(
      new URL(`./_c212-calc-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.sql`, import.meta.url),
      n.parameters.query,
    );
    console.log('sql', n.name);
  }
}

// Also check EXECUTAR TESTE for status update
const te = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const teNodes = typeof te.rows[0].nodes === 'string' ? JSON.parse(te.rows[0].nodes) : te.rows[0].nodes;
for (const n of teNodes) {
  if (/atualiz|montar|final|status|métric/i.test(n.name || '')) {
    console.log('TESTE node', n.name, n.type);
    writeFileSync(
      new URL(`./_c212-te-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
      n.parameters?.jsCode || n.parameters?.query || JSON.stringify(n.parameters),
    );
  }
}

// Check if Atualizar run in dataset might be overwritten elsewhere - list all code mentioning FAILED
for (const wfId of ['12t0Ol6zWQJgAKPC', 'KdpEmEGHNlPICOa4', '1uITQcJ5jSNXErOM']) {
  const r = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [wfId]);
  const nodes2 = typeof r.rows[0].nodes === 'string' ? JSON.parse(r.rows[0].nodes) : r.rows[0].nodes;
  for (const n of nodes2) {
    const blob = (n.parameters?.jsCode || '') + (n.parameters?.query || '');
    if (/FAILED|status\s*=/.test(blob) && /ai_test_runs|status/.test(blob)) {
      console.log('HIT', r.rows[0].name, '::', n.name);
    }
  }
}

await client.end();
