import fs from 'fs';

const decideFn = `function decidePostOcrAction(evalResult, ocrAttempts, maxAttempts, ocrMode) {
  const attempts = Number(ocrAttempts) || 1;
  const max = Number(maxAttempts) || 3;
  const mode = String(ocrMode || 'STANDARD').toUpperCase();

  if (evalResult.usable) {
    return {
      action: 'SUCCESS',
      ocrStatus: 'SUCCESS',
      qualityGrade: evalResult.grade,
      reviewReason: null,
    };
  }

  // STANDARD insuficiente → uma tentativa HIGH_QUALITY (nunca na 1ª)
  if (mode !== 'HIGH_QUALITY' && attempts < max) {
    return {
      action: 'HIGH_QUALITY_RETRY',
      ocrStatus: 'PROCESSING',
      qualityGrade: evalResult.grade,
      reviewReason: \`RETRY_HQ:\${evalResult.grade}:\${buildQualityReason(evalResult) || 'LOW_QUALITY'}\`,
    };
  }

  return {
    action: 'MANUAL_REVIEW',
    ocrStatus: 'MANUAL_REVIEW',
    qualityGrade: 'MANUAL_REVIEW',
    reviewReason: \`EXHAUSTED:\${evalResult.grade}:\${buildQualityReason(evalResult) || 'LOW_QUALITY'}\`,
  };
}`;

function replaceDecide(code) {
  return code.replace(
    /function decidePostOcrAction\([\s\S]*?\n\}/,
    decideFn,
  );
}

// STANDARD pós-OCR
let pos = fs.readFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos.live.js', 'utf8');
pos = replaceDecide(pos);
pos = pos.replace(
  /const decision = decidePostOcrAction\(quality, ocrAttempts, maxAttempts\);\nconst ocrMode = val\.ocrMode \|\| av\.ocrMode \|\| \(ocrAttempts >= 2 \? 'HIGH_QUALITY' : 'STANDARD'\);/,
  `const ocrMode = val.ocrMode || av.ocrMode || 'STANDARD';
const decision = decidePostOcrAction(quality, ocrAttempts, maxAttempts, ocrMode);`,
);
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos.live.js', pos);

// HQ pós-OCR
let hq = fs.readFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos-hq.live.js', 'utf8');
hq = replaceDecide(hq);
hq = hq.replace(
  /const decision = decidePostOcrAction\(quality, ocrAttempts, maxAttempts\);\nconst ocrMode = 'HIGH_QUALITY';/,
  `const ocrMode = 'HIGH_QUALITY';
const decision = decidePostOcrAction(quality, ocrAttempts, maxAttempts, ocrMode);`,
);
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos-hq.live.js', hq);

// Marcar revisão — incluir contagens
const marcarRevisao = `={{ (() => {
  const j = $json;
  const esc = (s) => String(s ?? '').replace(/'/g, "''");
  const score = (j.ocrQualityScore === null || j.ocrQualityScore === undefined) ? 'NULL' : Number(j.ocrQualityScore);
  const metrics = j.ocrQualityMetrics ? \`'\${JSON.stringify(j.ocrQualityMetrics).replace(/'/g, "''")}'::jsonb\` : 'NULL';
  const reason = j.ocrQualityReason ? \`'\${esc(j.ocrQualityReason)}'\` : 'NULL';
  const review = j.ocrReviewReason ? \`'\${esc(j.ocrReviewReason)}'\` : 'NULL';
  const mode = j.ocrMode ? \`'\${esc(j.ocrMode)}'\` : 'NULL';
  const wordCount = (j.ocrWordCount === null || j.ocrWordCount === undefined) ? 'NULL' : Number(j.ocrWordCount);
  const uniqueWordCount = (j.ocrUniqueWordCount === null || j.ocrUniqueWordCount === undefined) ? 'NULL' : Number(j.ocrUniqueWordCount);
  const charCount = (j.ocrCharacterCount === null || j.ocrCharacterCount === undefined) ? 'NULL' : Number(j.ocrCharacterCount);
  const charsPerPage = (j.ocrCharactersPerPage === null || j.ocrCharactersPerPage === undefined) ? 'NULL' : Number(j.ocrCharactersPerPage);
  return \`WITH v AS (
  UPDATE document_versions
  SET ocr_status = 'MANUAL_REVIEW',
      processing_status = 'failed',
      status = 'FAILED',
      ocr_finished_at = COALESCE(ocr_finished_at, NOW()),
      ocr_quality_score = \${score},
      ocr_quality_grade = 'MANUAL_REVIEW',
      ocr_word_count = \${wordCount},
      ocr_unique_word_count = \${uniqueWordCount},
      ocr_character_count = \${charCount},
      ocr_characters_per_page = \${charsPerPage},
      ocr_quality_reason = \${reason},
      ocr_review_reason = \${review},
      ocr_quality_metrics = \${metrics},
      ocr_mode = COALESCE(\${mode}, ocr_mode)
  WHERE id = '\${esc(j.versionId)}'::uuid
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
  '\${esc(j.requestId)}' AS "requestId",
  '\${esc(j.userId)}' AS "userId",
  '\${esc(j.sessionId)}' AS "sessionId",
  \${Number(j.textLength) || 0} AS "textLength",
  \${Number(j.ocrAttempts) || 0} AS "ocrAttempts",
  \${score} AS "ocrQualityScore",
  'MANUAL_REVIEW' AS "ocrQualityGrade",
  \${review} AS "ocrReviewReason",
  \${wordCount} AS "ocrWordCount",
  \${uniqueWordCount} AS "ocrUniqueWordCount",
  \${charCount} AS "ocrCharacterCount",
  \${charsPerPage} AS "ocrCharactersPerPage",
  \${reason} AS "ocrQualityReason",
  COALESCE(\${mode}, 'HIGH_QUALITY') AS "ocrMode"
FROM v;\`;
})() }}`;
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/marcar-revisao.live.sql.js', marcarRevisao);

// Marcar iniciado — force reseta ladder STANDARD
const marcarIniciado = `={{ (() => {
  const j = $json;
  const esc = (s) => String(s ?? '').replace(/'/g, "''");
  const force = j.force === true || j.force === 'true';
  const attemptsExpr = force ? '1' : 'ocr_attempts + 1';
  return \`WITH v AS (
  UPDATE document_versions
  SET ocr_status = 'PROCESSING',
      ocr_attempts = \${attemptsExpr},
      ocr_started_at = NOW(),
      ocr_engine = 'ocrmypdf+tesseract',
      ocr_languages = '\${esc(j.languages)}',
      ocr_mode = 'STANDARD'
  WHERE id = '\${esc(j.versionId)}'::uuid
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
FROM v;\`;
})() }}`;
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/marcar-iniciado.live.sql', marcarIniciado);

console.log('patched files ok');
console.log('pos has mode arg', fs.readFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos.live.js','utf8').includes('decidePostOcrAction(quality, ocrAttempts, maxAttempts, ocrMode)'));
console.log('hq has mode arg', fs.readFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/avaliar-pos-hq.live.js','utf8').includes("const ocrMode = 'HIGH_QUALITY'"));
