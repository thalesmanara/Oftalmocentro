#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Fix Avaliar VALUES
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const avaliar = nodes.find((n) => n.name === 'Avaliar e montar insert');
  let js = avaliar.parameters.jsCode;

  // Fix VALUES ending - currently missing retrieval fields after promptVersionIdSql
  const badEnd =
    `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\\n" +\n  ") RETURNING`;
  const goodEnd =
    `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + ",\\n" +\n` +
    `  "  " + (candidatesRetrieved == null ? 'NULL' : String(candidatesRetrieved)) + ", " + (candidatesReranked == null ? 'NULL' : String(candidatesReranked)) + ", " + (expectedDocumentRank == null ? 'NULL' : String(expectedDocumentRank)) + ",\\n" +\n` +
    `  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +\n` +
    `  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\\n" +\n` +
    `  "  " + (sourcePrecision == null ? 'NULL' : String(sourcePrecision)) + ", " + (sourceRecall == null ? 'NULL' : String(sourceRecall)) + ",\\n" +\n` +
    `  "  '" + j(rankedDocumentIds) + "'::jsonb\\n" +\n` +
    `  ") RETURNING`;

  if (js.includes(badEnd.replace(/\\n/g, '\n')) || js.includes(`promptVersionIdSql + "\n" +\n  ") RETURNING`)) {
    js = js.replace(
      `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\n" +\n  ") RETURNING`,
      `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + ",\n" +\n` +
        `  "  " + (candidatesRetrieved == null ? 'NULL' : String(candidatesRetrieved)) + ", " + (candidatesReranked == null ? 'NULL' : String(candidatesReranked)) + ", " + (expectedDocumentRank == null ? 'NULL' : String(expectedDocumentRank)) + ",\n" +\n` +
        `  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\n" +\n` +
        `  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\n" +\n` +
        `  "  " + (sourcePrecision == null ? 'NULL' : String(sourcePrecision)) + ", " + (sourceRecall == null ? 'NULL' : String(sourceRecall)) + ",\n" +\n` +
        `  "  '" + j(rankedDocumentIds) + "'::jsonb\n" +\n` +
        `  ") RETURNING`,
    );
  }

  // Also remove rerank_score from column list if we pass NULL without column alignment - column list has rerank_score
  // Columns: ... fallback_used, rerank_score, retrieval_mode ... Values have: fallback, NULL, mode - OK

  avaliar.parameters.jsCode = js;
  const valuesOk = js.includes('rankedDocumentIds) + "\'::jsonb');
  console.log('avaliar values patched', valuesOk, 'still old end', js.includes(`promptVersionIdSql + "\n" +\n  ") RETURNING`));

  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='KdpEmEGHNlPICOa4'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  writeFileSync(new URL('./_avaliar-fixed-tail.js', import.meta.url), js.slice(js.indexOf('const sql')));
}

// Fix CALCULAR MÉTRICAS SQL properly by rewriting Agregar métricas return SQL section
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const agg = nodes.find((n) => (n.parameters?.jsCode || '').includes('aggregateMetrics'));
  let js = agg.parameters.jsCode;

  // If recallAtK computed but not in SQL, replace entire sql building from const sql =
  if (js.includes('recallAtK') && !js.includes('recall_at_k')) {
    const start = js.indexOf('const sql = "INSERT INTO ai_test_metrics');
    const end = js.indexOf('const overallScoreSql');
    if (start >= 0 && end > start) {
      const newSql = `const sql = "INSERT INTO ai_test_metrics (\\n" +
  "  run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms, max_duration_ms,\\n" +
  "  sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count, subcategory_correct_count,\\n" +
  "  hallucination_count, empty_answer_count, internal_error_count, passed_count, failed_count, total_count, overall_score,\\n" +
  "  top_errors, top_documents, score_formula, recall_at_k, precision_at_k, mrr, hit_rate,\\n" +
  "  avg_rerank_latency_ms, fallback_count, retrieval_cases_evaluated, retrieval_cases_skipped, source_precision, source_recall\\n" +
  ") VALUES (\\n" +
  "  '" + esc(runId) + "'::uuid,\\n" +
  "  " + (agg.precision ?? 'NULL') + ",\\n" +
  "  " + (agg.recall ?? 'NULL') + ",\\n" +
  "  " + (agg.documentCoverage ?? 'NULL') + ",\\n" +
  "  '" + j(agg.categoryCoverage) + "'::jsonb,\\n" +
  "  " + (agg.avgDurationMs ?? 'NULL') + ",\\n" +
  "  " + (agg.minDurationMs ?? 'NULL') + ",\\n" +
  "  " + (agg.maxDurationMs ?? 'NULL') + ",\\n" +
  "  " + agg.sourcesCorrectCount + ", " + agg.sourcesIncorrectCount + ", " + agg.documentCorrectCount + ",\\n" +
  "  " + agg.categoryCorrectCount + ", " + agg.subcategoryCorrectCount + ",\\n" +
  "  " + agg.hallucinationCount + ", " + agg.emptyAnswerCount + ", " + agg.internalErrorCount + ",\\n" +
  "  " + agg.passedCount + ", " + agg.failedCount + ", " + agg.totalCount + ", " + (agg.overallScore ?? 'NULL') + ",\\n" +
  "  '" + j(agg.topErrors) + "'::jsonb, '" + j(agg.topDocuments) + "'::jsonb, '" + esc(agg.scoreFormula) + "',\\n" +
  "  " + (agg.recallAtK ?? 'NULL') + ", " + (agg.precisionAtK ?? 'NULL') + ", " + (agg.mrr ?? 'NULL') + ", " + (agg.hitRate ?? 'NULL') + ",\\n" +
  "  " + (agg.avgRerankLatencyMs ?? 'NULL') + ", " + (agg.fallbackCount ?? 0) + ", " + (agg.retrievalCasesEvaluated ?? 0) + ", " + (agg.retrievalCasesSkipped ?? 0) + ",\\n" +
  "  " + (agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\\n" +
  ") ON CONFLICT (run_id) DO UPDATE SET\\n" +
  "  precision = EXCLUDED.precision, recall = EXCLUDED.recall, document_coverage = EXCLUDED.document_coverage,\\n" +
  "  category_coverage = EXCLUDED.category_coverage, avg_duration_ms = EXCLUDED.avg_duration_ms,\\n" +
  "  min_duration_ms = EXCLUDED.min_duration_ms, max_duration_ms = EXCLUDED.max_duration_ms,\\n" +
  "  sources_correct_count = EXCLUDED.sources_correct_count, sources_incorrect_count = EXCLUDED.sources_incorrect_count,\\n" +
  "  document_correct_count = EXCLUDED.document_correct_count, category_correct_count = EXCLUDED.category_correct_count,\\n" +
  "  subcategory_correct_count = EXCLUDED.subcategory_correct_count, hallucination_count = EXCLUDED.hallucination_count,\\n" +
  "  empty_answer_count = EXCLUDED.empty_answer_count, internal_error_count = EXCLUDED.internal_error_count,\\n" +
  "  passed_count = EXCLUDED.passed_count, failed_count = EXCLUDED.failed_count, total_count = EXCLUDED.total_count,\\n" +
  "  overall_score = EXCLUDED.overall_score, top_errors = EXCLUDED.top_errors, top_documents = EXCLUDED.top_documents,\\n" +
  "  score_formula = EXCLUDED.score_formula,\\n" +
  "  recall_at_k = EXCLUDED.recall_at_k, precision_at_k = EXCLUDED.precision_at_k, mrr = EXCLUDED.mrr, hit_rate = EXCLUDED.hit_rate,\\n" +
  "  avg_rerank_latency_ms = EXCLUDED.avg_rerank_latency_ms, fallback_count = EXCLUDED.fallback_count,\\n" +
  "  retrieval_cases_evaluated = EXCLUDED.retrieval_cases_evaluated, retrieval_cases_skipped = EXCLUDED.retrieval_cases_skipped,\\n" +
  "  source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall\\n" +
  "RETURNING id, run_id, precision, recall, recall_at_k, precision_at_k, mrr, hit_rate, overall_score, created_at;";
`;
      // The template above uses \\n in string for the file - but we need actual newlines in JS source as \n escapes inside the code string.
      // Better write with real structure matching existing style (concatenation with "\n").
      const replacement = `const sql = "INSERT INTO ai_test_metrics (\\n" +
  "  run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms, max_duration_ms,\\n" +
  "  sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count, subcategory_correct_count,\\n" +
  "  hallucination_count, empty_answer_count, internal_error_count, passed_count, failed_count, total_count, overall_score,\\n" +
  "  top_errors, top_documents, score_formula, recall_at_k, precision_at_k, mrr, hit_rate,\\n" +
  "  avg_rerank_latency_ms, fallback_count, retrieval_cases_evaluated, retrieval_cases_skipped, source_precision, source_recall\\n" +
  ") VALUES (\\n" +
  "  '" + esc(runId) + "'::uuid,\\n" +
  "  " + (agg.precision ?? 'NULL') + ",\\n" +
  "  " + (agg.recall ?? 'NULL') + ",\\n" +
  "  " + (agg.documentCoverage ?? 'NULL') + ",\\n" +
  "  '" + j(agg.categoryCoverage) + "'::jsonb,\\n" +
  "  " + (agg.avgDurationMs ?? 'NULL') + ",\\n" +
  "  " + (agg.minDurationMs ?? 'NULL') + ",\\n" +
  "  " + (agg.maxDurationMs ?? 'NULL') + ",\\n" +
  "  " + agg.sourcesCorrectCount + ", " + agg.sourcesIncorrectCount + ", " + agg.documentCorrectCount + ",\\n" +
  "  " + agg.categoryCorrectCount + ", " + agg.subcategoryCorrectCount + ",\\n" +
  "  " + agg.hallucinationCount + ", " + agg.emptyAnswerCount + ", " + agg.internalErrorCount + ",\\n" +
  "  " + agg.passedCount + ", " + agg.failedCount + ", " + agg.totalCount + ", " + (agg.overallScore ?? 'NULL') + ",\\n" +
  "  '" + j(agg.topErrors) + "'::jsonb, '" + j(agg.topDocuments) + "'::jsonb, '" + esc(agg.scoreFormula) + "',\\n" +
  "  " + (agg.recallAtK ?? 'NULL') + ", " + (agg.precisionAtK ?? 'NULL') + ", " + (agg.mrr ?? 'NULL') + ", " + (agg.hitRate ?? 'NULL') + ",\\n" +
  "  " + (agg.avgRerankLatencyMs ?? 'NULL') + ", " + (agg.fallbackCount ?? 0) + ", " + (agg.retrievalCasesEvaluated ?? 0) + ", " + (agg.retrievalCasesSkipped ?? 0) + ",\\n" +
  "  " + (agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\\n" +
  ") ON CONFLICT (run_id) DO UPDATE SET\\n" +
  "  precision = EXCLUDED.precision, recall = EXCLUDED.recall, document_coverage = EXCLUDED.document_coverage,\\n" +
  "  category_coverage = EXCLUDED.category_coverage, avg_duration_ms = EXCLUDED.avg_duration_ms,\\n" +
  "  min_duration_ms = EXCLUDED.min_duration_ms, max_duration_ms = EXCLUDED.max_duration_ms,\\n" +
  "  sources_correct_count = EXCLUDED.sources_correct_count, sources_incorrect_count = EXCLUDED.sources_incorrect_count,\\n" +
  "  document_correct_count = EXCLUDED.document_correct_count, category_correct_count = EXCLUDED.category_correct_count,\\n" +
  "  subcategory_correct_count = EXCLUDED.subcategory_correct_count, hallucination_count = EXCLUDED.hallucination_count,\\n" +
  "  empty_answer_count = EXCLUDED.empty_answer_count, internal_error_count = EXCLUDED.internal_error_count,\\n" +
  "  passed_count = EXCLUDED.passed_count, failed_count = EXCLUDED.failed_count, total_count = EXCLUDED.total_count,\\n" +
  "  overall_score = EXCLUDED.overall_score, top_errors = EXCLUDED.top_errors, top_documents = EXCLUDED.top_documents,\\n" +
  "  score_formula = EXCLUDED.score_formula,\\n" +
  "  recall_at_k = EXCLUDED.recall_at_k, precision_at_k = EXCLUDED.precision_at_k, mrr = EXCLUDED.mrr, hit_rate = EXCLUDED.hit_rate,\\n" +
  "  avg_rerank_latency_ms = EXCLUDED.avg_rerank_latency_ms, fallback_count = EXCLUDED.fallback_count,\\n" +
  "  retrieval_cases_evaluated = EXCLUDED.retrieval_cases_evaluated, retrieval_cases_skipped = EXCLUDED.retrieval_cases_skipped,\\n" +
  "  source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall\\n" +
  "RETURNING id, run_id, precision, recall, recall_at_k, precision_at_k, mrr, hit_rate, overall_score, created_at;";
`;
      // Convert \\n in replacement to actual \n sequences as they appear in n8n code (backslash-n inside quotes)
      const fixed = replacement.replace(/\\n/g, '\\n'); // keep as \n for JS string content
      // Actually in the file we need the characters: quote backslash n quote
      // When I write replacement with \\n in a JS template literal, it becomes \n in the output string - correct for n8n code.
      js = js.slice(0, start) + fixed + '\n' + js.slice(end);
      agg.parameters.jsCode = js;
      console.log('metrics SQL replaced', js.includes('recall_at_k'));
    }
  }

  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='1uITQcJ5jSNXErOM'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='1uITQcJ5jSNXErOM' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
}

await client.end();
console.log('fixes done');
