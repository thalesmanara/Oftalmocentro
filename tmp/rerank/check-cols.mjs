#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const colsR = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_results' AND column_name ILIKE '%recall%' OR (table_name='ai_test_results' AND column_name ILIKE '%mrr%')
     OR (table_name='ai_test_results' AND column_name ILIKE '%hit%')
     OR (table_name='ai_test_results' AND column_name ILIKE '%candidate%')
     OR (table_name='ai_test_results' AND column_name ILIKE '%retrieval%')
  ORDER BY column_name
`);
const colsM = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_metrics' AND (
    column_name ILIKE '%recall%' OR column_name ILIKE '%mrr%' OR column_name ILIKE '%hit%'
    OR column_name ILIKE '%precision%' OR column_name ILIKE '%fallback%' OR column_name ILIKE '%rerank%'
  ) ORDER BY column_name
`);

const runs = await client.query(`
  SELECT id, overall_score, retrieval_mode, retrieval_config_version, mode_override_used,
         total_cases, duration_ms, started_at
  FROM ai_test_runs
  WHERE id IN ('a4117044-46ea-471e-b8b6-bc635cf0ee3d','4fb2148c-fa72-4332-a4e6-a2f8c0c0c0c0')
     OR (started_at > NOW() - INTERVAL '1 hour' AND total_cases >= 1)
  ORDER BY started_at DESC LIMIT 6
`);

const mets = await client.query(`
  SELECT * FROM ai_test_metrics WHERE run_id = ANY($1::uuid[])
`, [runs.rows.map((r) => r.id)]);

const resCols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_results' ORDER BY ordinal_position
`);

writeFileSync(new URL('./_cols.json', import.meta.url), JSON.stringify({
  resultRetrievalCols: colsR.rows,
  metricsCols: colsM.rows,
  allResultCols: resCols.rows.map((r) => r.column_name),
  runs: runs.rows,
  mets: mets.rows,
}, null, 2));
console.log(JSON.stringify({
  resultRetrievalCols: colsR.rows,
  metricsCols: colsM.rows,
  runs: runs.rows,
  metKeys: mets.rows[0] ? Object.keys(mets.rows[0]) : [],
  sampleMet: mets.rows[0],
}, null, 2));
await client.end();
