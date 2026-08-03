=SELECT r.id, r.run_id, r.case_id, r.case_code, r.question, r.answer, r.duration_ms, r.sources,
  r.chunk_refs, r.classification, r.matched_document, r.matched_category, r.matched_subcategory,
  r.required_words_hit, r.required_words_total, r.forbidden_words_hit, r.sources_correct,
  r.sources_incorrect, r.is_hallucination, r.is_empty_answer, r.is_internal_error, r.score,
  r.verdict, r.score_breakdown, r.created_at,
  c.expect_no_answer, c.group_name, c.expected_document_id
FROM ai_test_results r
JOIN ai_test_cases c ON c.id = r.case_id
WHERE r.run_id = '{{ $json.runId }}'::uuid
ORDER BY r.created_at ASC;