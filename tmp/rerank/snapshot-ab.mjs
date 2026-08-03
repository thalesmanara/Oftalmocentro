#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const runs = await client.query(`
  SELECT id, overall_score, retrieval_mode, retrieval_config_version, mode_override_used,
         total_cases, duration_ms, started_at
  FROM ai_test_runs
  WHERE started_at > NOW() - INTERVAL '2 hours'
  ORDER BY started_at DESC LIMIT 10
`);

const mets = await client.query(`
  SELECT m.* FROM ai_test_metrics m
  JOIN ai_test_runs r ON r.id=m.run_id
  WHERE r.started_at > NOW() - INTERVAL '2 hours'
  ORDER BY r.started_at DESC LIMIT 10
`);

const results = await client.query(`
  SELECT run_id, case_code, verdict, score, recall_at_k, precision_at_k, mrr, hit_rate,
         expected_document_rank, candidates_retrieved, candidates_reranked, final_context_count,
         retrieval_latency_ms, rerank_latency_ms, fallback_used, source_precision, source_recall
  FROM ai_test_results
  WHERE run_id = ANY($1::uuid[])
  ORDER BY created_at DESC LIMIT 20
`, [runs.rows.map((r) => r.id)]);

const secrets = await client.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval%' ORDER BY key`,
);
const versions = await client.query(
  `SELECT version_label, status, mode FROM ai_retrieval_config_versions ORDER BY version_number`,
);

const coverage = await client.query(`
  SELECT
    COUNT(*) FILTER (WHERE expected_document_id IS NOT NULL OR cardinality(expected_document_ids)>0) AS with_doc_ref,
    COUNT(*) FILTER (WHERE expected_chunk_id IS NOT NULL) AS with_chunk_ref,
    COUNT(*) AS total
  FROM ai_test_cases WHERE status='active'
`);

writeFileSync(
  new URL('./_ab-metrics-snapshot.json', import.meta.url),
  JSON.stringify({ runs: runs.rows, mets: mets.rows, results: results.rows, secrets: secrets.rows, versions: versions.rows, coverage: coverage.rows[0] }, null, 2),
);
console.log(JSON.stringify({
  runs: runs.rows.slice(0, 4),
  sampleResults: results.rows.slice(0, 4),
  coverage: coverage.rows[0],
  secrets: secrets.rows,
  versions: versions.rows,
}, null, 2));
await client.end();
