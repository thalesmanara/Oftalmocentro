#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ids = {
  DATASET: '12t0Ol6zWQJgAKPC',
};
const found = await client.query(
  `SELECT id, name FROM workflow_entity WHERE name ILIKE '%EXECUTAR TESTE%' OR name ILIKE '%EXECUTAR DATASET%' OR name ILIKE '%CALCULAR%' OR name ILIKE '%AVALIAR%'`,
);
console.log('found', found.rows);

for (const id of [ids.DATASET, ...found.rows.map((r) => r.id)]) {
  const { rows } = await client.query(`SELECT id, name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  if (!rows[0]) continue;
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const summary = nodes.map((n) => ({
    name: n.name,
    type: n.type,
    wf: n.parameters?.workflowId?.value || n.parameters?.workflowId,
    hasJs: !!n.parameters?.jsCode,
    jsLen: n.parameters?.jsCode?.length || 0,
    queryHas: n.parameters?.query
      ? {
          insertResults: n.parameters.query.includes('ai_test_results'),
          insertMetrics: n.parameters.query.includes('ai_test_metrics'),
          retrieval: n.parameters.query.includes('retrieval'),
        }
      : null,
  }));
  writeFileSync(new URL(`./_wf-${rows[0].id}.json`, import.meta.url), JSON.stringify({ name: rows[0].name, summary }, null, 2));
  // dump metric-related code nodes
  for (const n of nodes) {
    if (
      n.parameters?.jsCode &&
      (n.name.toLowerCase().includes('métric') ||
        n.name.toLowerCase().includes('metric') ||
        n.name.toLowerCase().includes('avaliar') ||
        n.name.toLowerCase().includes('score') ||
        n.name.toLowerCase().includes('resultado') ||
        n.parameters.jsCode.includes('overallScore') ||
        n.parameters.jsCode.includes('recall') ||
        n.parameters.jsCode.includes('precision'))
    ) {
      writeFileSync(
        new URL(`./_code-${rows[0].id}-${n.name.replace(/[^\w]+/g, '_')}.js`, import.meta.url),
        n.parameters.jsCode,
      );
      console.log('dumped', rows[0].name, n.name, n.parameters.jsCode.length);
    }
  }
}

// case columns
const cols = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='ai_test_cases' ORDER BY ordinal_position`);
writeFileSync(new URL('./_ai_test_cases_cols.json', import.meta.url), JSON.stringify(cols.rows, null, 2));

// sample case with expected
const sample = await client.query(`
  SELECT code, group_name, expected_document_id, expected_document_ids, required_source_document_id
  FROM ai_test_cases WHERE status='active' AND expected_document_id IS NOT NULL LIMIT 5`);
console.log('sample cases', sample.rows);

await client.end();
