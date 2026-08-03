={{ (() => {
  const j = $json;
  const esc = (s) => String(s ?? '').replace(/'/g, "''");
  const score = (j.ocrQualityScore === null || j.ocrQualityScore === undefined) ? 'NULL' : Number(j.ocrQualityScore);
  const metrics = j.ocrQualityMetrics ? `'${JSON.stringify(j.ocrQualityMetrics).replace(/'/g, "''")}'::jsonb` : 'NULL';
  const reason = j.ocrQualityReason ? `'${esc(j.ocrQualityReason)}'` : 'NULL';
  const review = j.ocrReviewReason ? `'${esc(j.ocrReviewReason)}'` : 'NULL';
  const mode = j.ocrMode ? `'${esc(j.ocrMode)}'` : 'NULL';
  const wordCount = (j.ocrWordCount === null || j.ocrWordCount === undefined) ? 'NULL' : Number(j.ocrWordCount);
  const uniqueWordCount = (j.ocrUniqueWordCount === null || j.ocrUniqueWordCount === undefined) ? 'NULL' : Number(j.ocrUniqueWordCount);
  const charCount = (j.ocrCharacterCount === null || j.ocrCharacterCount === undefined) ? 'NULL' : Number(j.ocrCharacterCount);
  const charsPerPage = (j.ocrCharactersPerPage === null || j.ocrCharactersPerPage === undefined) ? 'NULL' : Number(j.ocrCharactersPerPage);
  return `WITH v AS (
  UPDATE document_versions
  SET ocr_status = 'MANUAL_REVIEW',
      processing_status = 'failed',
      status = 'FAILED',
      ocr_finished_at = COALESCE(ocr_finished_at, NOW()),
      ocr_quality_score = ${score},
      ocr_quality_grade = 'MANUAL_REVIEW',
      ocr_word_count = ${wordCount},
      ocr_unique_word_count = ${uniqueWordCount},
      ocr_character_count = ${charCount},
      ocr_characters_per_page = ${charsPerPage},
      ocr_quality_reason = ${reason},
      ocr_review_reason = ${review},
      ocr_quality_metrics = ${metrics},
      ocr_mode = COALESCE(${mode}, ocr_mode)
  WHERE id = '${esc(j.versionId)}'::uuid
  RETURNING id, document_id
), d AS (
  UPDATE documents
  SET processing_status = 'failed', updated_at = NOW()
  FROM v
  WHERE documents.id = v.document_id
  RETURNING documents.id
)
SELECT
  v.id AS "versionId",
  v.document_id AS "documentId",
  '${esc(j.requestId)}' AS "requestId",
  '${esc(j.userId)}' AS "userId",
  '${esc(j.sessionId)}' AS "sessionId",
  ${Number(j.textLength) || 0} AS "textLength",
  ${Number(j.ocrAttempts) || 0} AS "ocrAttempts",
  ${score} AS "ocrQualityScore",
  'MANUAL_REVIEW' AS "ocrQualityGrade",
  ${review} AS "ocrReviewReason",
  ${wordCount} AS "ocrWordCount",
  ${uniqueWordCount} AS "ocrUniqueWordCount",
  ${charCount} AS "ocrCharacterCount",
  ${charsPerPage} AS "ocrCharactersPerPage",
  ${reason} AS "ocrQualityReason",
  COALESCE(${mode}, 'HIGH_QUALITY') AS "ocrMode"
FROM v;`;
})() }}