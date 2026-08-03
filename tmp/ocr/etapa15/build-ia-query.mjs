import fs from 'fs';

const raw = fs.readFileSync(
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/086a1b11-8b72-4817-b530-543c4a400464.txt',
  'utf8'
);
const d = JSON.parse(raw);
const n = d.workflow.nodes.find((x) => x.name === 'Buscar chunks relevantes');
const oldLine =
  "AND COALESCE(dv.ocr_status, 'NOT_REQUIRED') NOT IN ('PROCESSING','FAILED','REQUIRED','OCR_REQUIRED','MANUAL_REVIEW','OCR_BUSY')";
const newLine =
  oldLine +
  "\n    AND (dv.ocr_quality_grade IS NULL OR dv.ocr_quality_grade IN ('EXCELLENT','GOOD','ACCEPTABLE'))";
const q = n.parameters.query;
if (!q.includes(oldLine)) {
  console.log('NOT FOUND');
  process.exit(1);
}
const newQ = q.replace(oldLine, newLine);
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/ocr/etapa15/consulta-ia-query.sql', newQ);
console.log('OK', newQ.length);
