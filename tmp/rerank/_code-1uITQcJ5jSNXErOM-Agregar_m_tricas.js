function aggregateMetrics(results){const total=results.length;const passed=results.filter(r=>r.verdict==='PASS').length;const failed=results.filter(r=>r.verdict==='FAIL').length;const errors=results.filter(r=>r.verdict==='ERROR').length;const durations=results.map(r=>Number(r.durationMs)).filter(n=>Number.isFinite(n));const scores=results.map(r=>Number(r.score)).filter(n=>Number.isFinite(n));const precision=total?Math.round((passed/total)*10000)/100:0;const answerable=results.filter(r=>!r.expectNoAnswer);const recall=answerable.length?Math.round((answerable.filter(r=>r.verdict==='PASS').length/answerable.length)*10000)/100:0;const docsExpected=new Set(results.map(r=>r.expectedDocumentId).filter(Boolean).map(String));const docsHit=new Set(results.filter(r=>r.matchedDocument&&r.expectedDocumentId).map(r=>String(r.expectedDocumentId)));const documentCoverage=docsExpected.size?Math.round((docsHit.size/docsExpected.size)*10000)/100:null;const byCat={};for(const r of results){const cat=r.groupName||'OUTROS';if(!byCat[cat])byCat[cat]={total:0,passed:0};byCat[cat].total+=1;if(r.verdict==='PASS')byCat[cat].passed+=1}const categoryCoverage={};for(const[k,v]of Object.entries(byCat)){categoryCoverage[k]={total:v.total,passed:v.passed,precision:Math.round((v.passed/v.total)*10000)/100}}const topErrors=results.filter(r=>r.verdict!=='PASS').slice(0,20).map(r=>({caseCode:r.caseCode,verdict:r.verdict,score:r.score,question:(r.question||'').slice(0,120)}));const docCounts={};for(const r of results){for(const s of r.sources||[]){const id=s.documentId||s.document_id;if(!id)continue;if(!docCounts[id])docCounts[id]={documentId:id,title:s.documentTitle||s.document_title,count:0};docCounts[id].count+=1}}const topDocuments=Object.values(docCounts).sort((a,b)=>b.count-a.count).slice(0,15);const overallScore=scores.length?Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*100)/100:0;return{precision,recall,documentCoverage,categoryCoverage,avgDurationMs:durations.length?Math.round((durations.reduce((a,b)=>a+b,0)/durations.length)*100)/100:null,minDurationMs:durations.length?Math.min(...durations):null,maxDurationMs:durations.length?Math.max(...durations):null,sourcesCorrectCount:results.filter(r=>r.sourcesCorrect).length,sourcesIncorrectCount:results.filter(r=>r.sourcesIncorrect).length,documentCorrectCount:results.filter(r=>r.matchedDocument).length,categoryCorrectCount:results.filter(r=>r.matchedCategory===true).length,subcategoryCorrectCount:results.filter(r=>r.matchedSubcategory===true).length,hallucinationCount:results.filter(r=>r.isHallucination).length,emptyAnswerCount:results.filter(r=>r.isEmptyAnswer).length,internalErrorCount:errors,passedCount:passed,failedCount:failed,totalCount:total,overallScore,topErrors,topDocuments,scoreFormula:'Per-case: answerQuality40 + sources30 + document20 + latency10. Run overall = average(case scores). Precision = passed/total.'}}
const rows = $input.all().map((i) => i.json).filter((j) => j && j.id);
const runId = $('Trigger').first().json.runId;
const mapped = rows.map((r) => ({
  verdict: r.verdict,
  score: r.score != null ? Number(r.score) : null,
  durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
  expectNoAnswer: !!r.expect_no_answer,
  expectedDocumentId: r.expected_document_id,
  matchedDocument: r.matched_document,
  matchedCategory: r.matched_category,
  matchedSubcategory: r.matched_subcategory,
  groupName: r.group_name,
  sourcesCorrect: r.sources_correct,
  sourcesIncorrect: r.sources_incorrect,
  isHallucination: r.is_hallucination,
  isEmptyAnswer: r.is_empty_answer,
  caseCode: r.case_code,
  question: r.question,
  sources: Array.isArray(r.sources) ? r.sources : [],
}));
const agg = aggregateMetrics(mapped);
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
function j(v) { return esc(JSON.stringify(v ?? null)); }
const sql = "INSERT INTO ai_test_metrics (\n" +
  "  run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms, max_duration_ms,\n" +
  "  sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count, subcategory_correct_count,\n" +
  "  hallucination_count, empty_answer_count, internal_error_count, passed_count, failed_count, total_count, overall_score,\n" +
  "  top_errors, top_documents, score_formula\n" +
  ") VALUES (\n" +
  "  '" + esc(runId) + "'::uuid,\n" +
  "  " + (agg.precision ?? 'NULL') + ",\n" +
  "  " + (agg.recall ?? 'NULL') + ",\n" +
  "  " + (agg.documentCoverage ?? 'NULL') + ",\n" +
  "  '" + j(agg.categoryCoverage) + "'::jsonb,\n" +
  "  " + (agg.avgDurationMs ?? 'NULL') + ",\n" +
  "  " + (agg.minDurationMs ?? 'NULL') + ",\n" +
  "  " + (agg.maxDurationMs ?? 'NULL') + ",\n" +
  "  " + agg.sourcesCorrectCount + ", " + agg.sourcesIncorrectCount + ", " + agg.documentCorrectCount + ",\n" +
  "  " + agg.categoryCorrectCount + ", " + agg.subcategoryCorrectCount + ",\n" +
  "  " + agg.hallucinationCount + ", " + agg.emptyAnswerCount + ", " + agg.internalErrorCount + ",\n" +
  "  " + agg.passedCount + ", " + agg.failedCount + ", " + agg.totalCount + ", " + (agg.overallScore ?? 'NULL') + ",\n" +
  "  '" + j(agg.topErrors) + "'::jsonb, '" + j(agg.topDocuments) + "'::jsonb, '" + esc(agg.scoreFormula) + "'\n" +
  ") ON CONFLICT (run_id) DO UPDATE SET\n" +
  "  precision = EXCLUDED.precision, recall = EXCLUDED.recall, document_coverage = EXCLUDED.document_coverage,\n" +
  "  category_coverage = EXCLUDED.category_coverage, avg_duration_ms = EXCLUDED.avg_duration_ms,\n" +
  "  min_duration_ms = EXCLUDED.min_duration_ms, max_duration_ms = EXCLUDED.max_duration_ms,\n" +
  "  sources_correct_count = EXCLUDED.sources_correct_count, sources_incorrect_count = EXCLUDED.sources_incorrect_count,\n" +
  "  document_correct_count = EXCLUDED.document_correct_count, category_correct_count = EXCLUDED.category_correct_count,\n" +
  "  subcategory_correct_count = EXCLUDED.subcategory_correct_count, hallucination_count = EXCLUDED.hallucination_count,\n" +
  "  empty_answer_count = EXCLUDED.empty_answer_count, internal_error_count = EXCLUDED.internal_error_count,\n" +
  "  passed_count = EXCLUDED.passed_count, failed_count = EXCLUDED.failed_count, total_count = EXCLUDED.total_count,\n" +
  "  overall_score = EXCLUDED.overall_score, top_errors = EXCLUDED.top_errors, top_documents = EXCLUDED.top_documents,\n" +
  "  score_formula = EXCLUDED.score_formula\n" +
  "RETURNING id, run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms,\n" +
  "  max_duration_ms, sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count,\n" +
  "  subcategory_correct_count, hallucination_count, empty_answer_count, internal_error_count, passed_count,\n" +
  "  failed_count, total_count, overall_score, top_errors, top_documents, score_formula, created_at;";
const overallScoreSql = agg.overallScore != null ? String(agg.overallScore) : 'NULL';
const sqlUpdateRun = "UPDATE ai_test_runs SET total_cases = " + agg.totalCount + ", passed_count = " + agg.passedCount + ", failed_count = " + agg.failedCount + ", error_count = " + agg.internalErrorCount + ", overall_score = " + overallScoreSql + " WHERE id = '" + esc(runId) + "'::uuid RETURNING id;";
return [{ json: { sql, sqlUpdateRun, runId, agg } }];