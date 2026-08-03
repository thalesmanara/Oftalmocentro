const sql = "INSERT INTO ai_test_results (\n" +
  "  run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs, classification,\n" +
  "  matched_document, matched_category, matched_subcategory, required_words_hit, required_words_total,\n" +
  "  forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination, is_empty_answer,\n" +
  "  is_internal_error, score, verdict, score_breakdown, extraction_method, ocr_quality_grade,\n" +
  "  ocr_used, sheet_name, headers_json, prompt_version, model_name, prompt_version_id,\n" +
"  candidates_retrieved, candidates_reranked, expected_document_rank, retrieval_latency_ms, rerank_latency_ms,\n" +
"  final_context_count, retrieval_config_version, fallback_used, rerank_score, retrieval_mode,\n" +
"  source_precision, source_recall, retrieval_ranked_document_ids\n" +
  ") VALUES (\n" +
  "  '" + esc(caso.run_id) + "'::uuid,\n" +
  "  '" + esc(caso.id) + "'::uuid,\n" +
  "  '" + esc(caso.code) + "',\n" +
  "  '" + esc(caso.question) + "',\n" +
  "  '" + esc(answer) + "',\n" +
  "  " + (durationMs == null ? 'NULL' : String(Math.round(durationMs))) + ",\n" +
  "  '" + j(sourcesSafe) + "'::jsonb,\n" +
  "  '" + j(chunkRefs) + "'::jsonb,\n" +
  "  '" + j(classification) + "'::jsonb,\n" +
  "  " + (scored.matchedDocument === true ? 'true' : scored.matchedDocument === false ? 'false' : 'NULL') + ",\n" +
  "  " + (scored.matchedCategory === true ? 'true' : scored.matchedCategory === false ? 'false' : 'NULL') + ",\n" +
  "  " + (scored.matchedSubcategory === true ? 'true' : scored.matchedSubcategory === false ? 'false' : 'NULL') + ",\n" +
  "  " + scored.requiredWordsHit + ", " + scored.requiredWordsTotal + ", " + scored.forbiddenWordsHit + ",\n" +
  "  " + (scored.sourcesCorrect ? 'true' : 'false') + ", " + (scored.sourcesIncorrect ? 'true' : 'false') + ",\n" +
  "  " + (scored.isHallucination ? 'true' : 'false') + ", " + (scored.isEmptyAnswer ? 'true' : 'false') + ",\n" +
  "  " + (scored.isInternalError ? 'true' : 'false') + ",\n" +
  "  " + scored.score + ", '" + esc(scored.verdict) + "',\n" +
  "  '" + j(scored.scoreBreakdown) + "'::jsonb,\n" +
  "  " + (caso.extraction_method ? "'" + esc(caso.extraction_method) + "'" : 'NULL') + ",\n" +
  "  " + (caso.ocr_quality_grade ? "'" + esc(caso.ocr_quality_grade) + "'" : 'NULL') + ",\n" +
  "  " + (ocrUsed ? 'true' : 'false') + ",\n" +
  "  " + (caso.sheet_name ? "'" + esc(caso.sheet_name) + "'" : 'NULL') + ",\n" +
  "  " + (caso.headers_json != null ? "'" + j(caso.headers_json) + "'::jsonb" : 'NULL') + ",\n" +
  "  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id, created_at;";
return [{ json: {
  sql,
  runId: caso.run_id,
  caseId: caso.id,
  caseCode: caso.code,
  question: caso.question,
  answer,
  durationMs,
  sources: sourcesSafe,
  chunkRefs,
  score: scored.score,
  verdict: scored.verdict,
  isHallucination: scored.isHallucination,
  isInternalError: scored.isInternalError,
  expectNoAnswer: !!caso.expect_no_answer,
  groupName: caso.group_name,
  expectedDocumentId: caso.expected_document_id,
  matchedDocument: scored.matchedDocument,
  sourcesCorrect: scored.sourcesCorrect,
  sourcesIncorrect: scored.sourcesIncorrect,
  promptVersionId: caso.prompt_version_id || null,
  expectedDocumentRank, recallAtK, precisionAtK, mrr, hitRate, sourcePrecision, sourceRecall,
  candidatesRetrieved, candidatesReranked, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode,
  rankedDocumentIds, retrievalCasesEvaluable,
}}];