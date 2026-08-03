={{ (() => {
  const j = $json;
  const esc = (s) => String(s ?? '').replace(/'/g, "''");
  const force = j.force === true || j.force === 'true';
  const attemptsExpr = force ? '1' : 'ocr_attempts + 1';
  return `WITH v AS (
  UPDATE document_versions
  SET ocr_status = 'PROCESSING',
      ocr_attempts = ${attemptsExpr},
      ocr_started_at = NOW(),
      ocr_engine = 'ocrmypdf+tesseract',
      ocr_languages = '${esc(j.languages)}',
      ocr_mode = 'STANDARD'
  WHERE id = '${esc(j.versionId)}'::uuid
  RETURNING id, document_id, file_path, ocr_attempts, ocr_mode
),
d AS (
  UPDATE documents
  SET processing_status = 'processing', updated_at = NOW()
  FROM v
  WHERE documents.id = v.document_id
    AND documents.processing_status <> 'processing'
  RETURNING documents.id
)
SELECT
  v.id AS "versionId",
  v.document_id AS "documentId",
  v.file_path AS "filePath",
  v.ocr_attempts AS "ocrAttempts",
  v.ocr_mode AS "ocrMode"
FROM v;`;
})() }}