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

const marker = '+ promptVersionIdSql + "\\n" +\n  ") RETURNING';
// In the actual code string, backslash-n is two chars. Let's find by indexOf pieces:
const a = js.indexOf('promptVersionIdSql + "');
console.log('a', a, JSON.stringify(js.slice(a, a + 40)));

const start = js.indexOf(`"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql`);
const end = js.indexOf('created_at;";', start);
console.log('start', start, 'end', end);
if (start < 0 || end < 0) {
  console.log('markers missing');
  await client.end();
  process.exit(1);
}

const replacement =
  `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + ",\\n" +
  "  " + (candidatesRetrieved == null ? 'NULL' : String(candidatesRetrieved)) + ", " + (candidatesReranked == null ? 'NULL' : String(candidatesReranked)) + ", " + (expectedDocumentRank == null ? 'NULL' : String(expectedDocumentRank)) + ",\\n" +
  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +
  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\\n" +
  "  " + (sourcePrecision == null ? 'NULL' : String(sourcePrecision)) + ", " + (sourceRecall == null ? 'NULL' : String(sourceRecall)) + ",\\n" +
  "  '" + j(rankedDocumentIds) + "'::jsonb\\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id,\\n" +
  "  candidates_retrieved, expected_document_rank, fallback_used, source_precision, source_recall, created_at;"`;

// The replacement above when written in this file: `\\n` in template becomes `\n` (backslash+n) in the string - correct for n8n JS source.

js = js.slice(0, start) + replacement + js.slice(end + 'created_at;";'.length);
avaliar.parameters.jsCode = js;

await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='KdpEmEGHNlPICOa4'`, [
  JSON.stringify(nodes),
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "versionId"=$2`,
    [JSON.stringify(nodes), rows[0].activeVersionId],
  );
}
console.log('OK has ranked insert', js.includes('j(rankedDocumentIds)'));
console.log('OK col/value', js.includes('source_recall') && js.includes('candidatesRetrieved'));
await client.end();
