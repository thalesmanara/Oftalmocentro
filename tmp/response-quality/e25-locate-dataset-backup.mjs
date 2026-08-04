#!/usr/bin/env node
/**
 * Etapa 25 — locate dataset runner + backup WF for policy fields
 */
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT id, name FROM workflow_entity
   WHERE name ILIKE '%dataset%' OR name ILIKE '%backup%' OR name ILIKE '%teste%ia%'
   ORDER BY name`,
);
console.log(rows);

for (const r of rows) {
  const { rows: w } = await c.query(`SELECT nodes::text AS n FROM workflow_entity WHERE id=$1`, [r.id]);
  const n = w[0].n;
  const hits = [];
  if (n.includes('ai_test_results')) hits.push('ai_test_results');
  if (n.includes('quality_score')) hits.push('quality_score');
  if (n.includes('response_quality')) hits.push('response_quality');
  if (n.includes('ai_response_quality')) hits.push('ai_response_quality');
  if (n.includes('INSERT INTO ai_test')) hits.push('INSERT_test');
  if (hits.length) console.log(r.id, r.name, hits);
}

// Find INSERT into ai_test_results node text snippet
const { rows: ds } = await c.query(
  `SELECT id, name, nodes FROM workflow_entity WHERE nodes::text ILIKE '%INSERT INTO ai_test_results%' LIMIT 5`,
);
for (const r of ds) {
  const nodes = typeof r.nodes === 'string' ? JSON.parse(r.nodes) : r.nodes;
  for (const n of nodes) {
    const q = n.parameters?.query || n.parameters?.jsCode || '';
    if (String(q).includes('INSERT INTO ai_test_results')) {
      console.log('\n===', r.id, r.name, n.name, '===');
      console.log(String(q).slice(0, 2500));
    }
  }
}

await c.end();
