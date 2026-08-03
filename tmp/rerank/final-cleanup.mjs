#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
await client.query(`
  UPDATE ai_retrieval_config_versions
  SET status='REJECTED', notes=COALESCE(notes,'') || ' [optest-cleanup]'
  WHERE version_label LIKE 'tmp-%' AND status <> 'PUBLISHED'
`);
const state = await client.query(`
  SELECT version_label, status, mode FROM ai_retrieval_config_versions ORDER BY version_number
`);
const secrets = await client.query(`
  SELECT key, value FROM app_secrets WHERE key IN ('retrieval_active_mode','retrieval_active_version') ORDER BY key
`);
const ab = await client.query(`
  SELECT id, retrieval_mode, retrieval_config_version, mode_override_used, overall_score, total_cases
  FROM ai_test_runs
  WHERE id IN ('a4117044-46ea-471e-b8b6-bc635cf0ee3d','4fb2148c-fa72-4332-a4e6-a225809ade51')
`);
const abm = await client.query(`
  SELECT run_id, overall_score, precision, recall, recall_at_k, precision_at_k, mrr, hit_rate,
         hallucination_count, sources_correct_count, document_correct_count,
         retrieval_cases_evaluated, retrieval_cases_skipped, fallback_count
  FROM ai_test_metrics WHERE run_id = ANY($1::uuid[])
`, [ab.rows.map((r) => r.id)]);

writeFileSync(new URL('./_final-state.json', import.meta.url), JSON.stringify({ state: state.rows, secrets: secrets.rows, ab: ab.rows, abm: abm.rows }, null, 2));
console.log(JSON.stringify({ state: state.rows, secrets: secrets.rows, ab: ab.rows, abm: abm.rows }, null, 2));
await client.end();
