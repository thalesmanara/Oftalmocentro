import fs from 'fs';

const anchor = '(dv.ocr_derived_file_path IS NOT NULL) AS "hasOcrDerivedFile"';
const addition = `${anchor},
  dv.ocr_quality_score AS "ocrQualityScore",
  dv.ocr_quality_grade AS "ocrQualityGrade",
  dv.ocr_word_count AS "ocrWordCount",
  dv.ocr_unique_word_count AS "ocrUniqueWordCount",
  dv.ocr_character_count AS "ocrCharacterCount",
  dv.ocr_characters_per_page AS "ocrCharactersPerPage",
  dv.ocr_quality_reason AS "ocrQualityReason",
  dv.ocr_review_reason AS "ocrReviewReason",
  dv.ocr_mode AS "ocrMode"`;

const jobs = [
  {
    file: 'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/versions.txt',
    node: 'Buscar versões',
  },
];

function patch(dumpPath, nodeName, outPath) {
  const d = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const n = d.workflow.nodes.find((x) => x.name === nodeName);
  const q = n.parameters.query;
  if (!q.includes(anchor)) {
    console.log('NOT FOUND in', nodeName);
    process.exit(1);
  }
  const newQ = q.replace(anchor, addition);
  fs.writeFileSync(outPath, newQ);
  console.log('OK', nodeName, newQ.length);
}

patch(
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/versions-dump.json',
  'Buscar versões',
  'C:/Revita/Oftalmocentro/tmp/ocr/etapa15/get-versions-query.sql'
);
patch(
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/detail-dump.json',
  'Buscar versão',
  'C:/Revita/Oftalmocentro/tmp/ocr/etapa15/get-detail-query.sql'
);
patch(
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/documentos-dump.json',
  'Execute a SQL query',
  'C:/Revita/Oftalmocentro/tmp/ocr/etapa15/get-documentos-query.sql'
);
