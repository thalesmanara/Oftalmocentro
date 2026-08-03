#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const avaliar = nodes.find((n) => n.name === 'Avaliar e montar insert');
let js = avaliar.parameters.jsCode;

const old = `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id, created_at;"`;

// Use actual newlines as in file
const oldReal = `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id, created_at;"`;

const neu = `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + ",\n" +
  "  " + (candidatesRetrieved == null ? 'NULL' : String(candidatesRetrieved)) + ", " + (candidatesReranked == null ? 'NULL' : String(candidatesReranked)) + ", " + (expectedDocumentRank == null ? 'NULL' : String(expectedDocumentRank)) + ",\n" +
  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\n" +
  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\n" +
  "  " + (sourcePrecision == null ? 'NULL' : String(sourcePrecision)) + ", " + (sourceRecall == null ? 'NULL' : String(sourceRecall)) + ",\n" +
  "  '" + j(rankedDocumentIds) + "'::jsonb\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id,\n" +
  "  candidates_retrieved, expected_document_rank, recall_at_k, precision_at_k, mrr, hit_rate, fallback_used, created_at;"`;

if (!js.includes(oldReal)) {
  console.log('OLD not found, trying flexible');
  const idx = js.indexOf(`promptVersionIdSql + "\n" +\n  ") RETURNING`);
  console.log('idx', idx);
  if (idx < 0) {
    // dump nearby
    const i2 = js.indexOf('promptVersionIdSql');
    console.log(JSON.stringify(js.slice(i2, i2 + 200)));
  }
} else {
  js = js.replace(oldReal, neu);
  // Also remove recall_at_k from RETURNING if columns don't exist on results - use only existing cols
  js = js.replace(
    `"  candidates_retrieved, expected_document_rank, recall_at_k, precision_at_k, mrr, hit_rate, fallback_used, created_at;"`,
    `"  candidates_retrieved, expected_document_rank, fallback_used, source_precision, source_recall, created_at;"`,
  );
  avaliar.parameters.jsCode = js;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json WHERE id='KdpEmEGHNlPICOa4'`, [JSON.stringify(nodes)]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  console.log('patched OK', js.includes("j(rankedDocumentIds)"));
}
await client.end();
