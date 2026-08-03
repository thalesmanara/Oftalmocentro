#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ids = [
  '0289408b8d774379',
  'e95a92295d7c4deb',
  'KdpEmEGHNlPICOa4',
  '12t0Ol6zWQJgAKPC',
  'wTH2YV6pIlhzWDiY',
  'qVH5qtBf8IY32uiH',
  '8EXk5RkFW5cxnenL',
  '8f0863b17b844c24',
  '70fd9924711b45f1',
  '5fbdabb413c3405d',
  '68acc8f5d57d4fac',
  '5b6dcd491b8d449e',
  'f83073bfb4154115',
  '708bf587fb73467f',
];

for (const id of ids) {
  const r = await client.query(
    `SELECT id, name, active, "activeVersionId", "versionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  console.log(JSON.stringify(r.rows[0] || { missing: id }));
}

const av = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof av.rows[0].nodes === 'string' ? JSON.parse(av.rows[0].nodes) : av.rows[0].nodes;
const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
const code = n.parameters.jsCode;
console.log('--- Avaliar markers ---');
for (const k of [
  'redundancyRate',
  'overflowDetected',
  'relevantContextRate',
  'sourceCoverage',
  'redundancy_rate',
  'overflow_detected',
  'conflict_type',
  'contextConfigVersionId',
]) {
  console.log(k, code.includes(k));
}
const idx = code.indexOf('INSERT INTO ai_test_results');
console.log('INSERT snippet:\n', code.slice(idx, idx + 1200));

const ir = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const irNodes = typeof ir.rows[0].nodes === 'string' ? JSON.parse(ir.rows[0].nodes) : ir.rows[0].nodes;
const inserir = irNodes.find((x) => /Inserir run/i.test(x.name));
console.log('--- Inserir run ---', inserir?.name);
console.log((inserir?.parameters?.query || '').slice(0, 1500));

const prod = await client.query(`
  SELECT version_label, mode, status FROM ai_context_config_versions
  WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST`);
console.log('PUBLISHED context:', prod.rows);

const ret = await client.query(`
  SELECT version_label, mode, status FROM ai_retrieval_config_versions
  WHERE status='PUBLISHED'`);
console.log('PUBLISHED retrieval:', ret.rows);

await client.end();
