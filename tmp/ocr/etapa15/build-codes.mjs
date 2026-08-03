import fs from 'fs';

const lib = fs
  .readFileSync('tmp/ocr/quality-eval.js', 'utf8')
  .replace(/module\.exports[\s\S]*$/, '')
  .trim();

const avaliar = `${lib}

const trig = $('Trigger').first().json;
const cfg = $input.first().json;

const versionId = trig.versionId;
const documentId = trig.documentId || cfg.documentId;
const requestId = trig.requestId || '';
const userId = trig.userId || '';
const sessionId = trig.sessionId || '';
const force = trig.force === true || trig.force === 'true';
const extractedText = trig.extractedText || '';
const modeIn = trig.mode || 'auto';

const versionExists = !!cfg.versionId;
const ocrEnabled = String(cfg.ocrEnabled ?? 'true').toLowerCase() === 'true';
const maxAttempts = Number(cfg.ocrMaxAttempts ?? 3);
const languages = cfg.ocrLanguages || 'por+eng';
const fileExtension = String(cfg.fileExtension || '').toLowerCase().replace(/^\\./, '');
const filePath = cfg.filePath || '';
const currentOcrStatus = cfg.ocrStatus || null;
const ocrAttempts = Number(cfg.ocrAttempts || 0);
const activeOcrCount = Number(cfg.activeOcrCount || 0);
const pageCount = Math.max(1, Number(cfg.pageCount || cfg.ocrPageCount || 1));
const excellentMin = Number(cfg.ocrQualityExcellentMin ?? 85);
const goodMin = Number(cfg.ocrQualityGoodMin ?? 70);
const acceptableMin = Number(cfg.ocrQualityAcceptableMin ?? 50);
const poorMin = Number(cfg.ocrQualityPoorMin ?? 30);

const quality = evaluateDocumentQuality(extractedText, {
  pageCount, excellentMin, goodMin, acceptableMin, poorMin,
});
const needDecision = decideNeedOcrFromTika(quality, force);
const ocrMode = ocrAttempts >= 1 ? 'HIGH_QUALITY' : 'STANDARD';

const base = {
  versionId, documentId, requestId, userId, sessionId, mode: modeIn,
  force, textLength: quality.metrics.characterCount, extractedText: quality.normalizedText,
  filePath, languages, maxAttempts, ocrAttempts, pageCount, ocrMode,
  ocrQualityScore: quality.score, ocrQualityGrade: quality.grade,
  ocrQualityReason: buildQualityReason(quality),
  ocrWordCount: quality.metrics.wordCount,
  ocrUniqueWordCount: quality.metrics.uniqueWordCount,
  ocrCharacterCount: quality.metrics.characterCount,
  ocrCharactersPerPage: quality.metrics.charsPerPage,
  ocrQualityMetrics: quality.metrics,
  minChars: Number(cfg.ocrMinTextChars ?? 80),
};

function result(extra, route) {
  return [{ json: { ...base, ...extra, stage: 'AVALIAR', route } }];
}

if (!versionExists) {
  return result({ ok: false, needOcr: false, code: 'OCR_VERSION_NOT_FOUND', message: 'Versão não encontrada para OCR.', extractionMethod: null, ocrStatus: null }, 'NOT_FOUND');
}
if (!ocrEnabled) {
  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'SKIPPED' }, 'LIGHT_UPDATE');
}
if (fileExtension !== 'pdf') {
  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'NOT_APPLICABLE' }, 'LIGHT_UPDATE');
}
if (!needDecision.needOcr) {
  return result({ ok: true, needOcr: false, extractionMethod: 'tika', ocrStatus: 'NOT_REQUIRED' }, 'LIGHT_UPDATE');
}
if (ocrAttempts >= maxAttempts && !force) {
  return result({ ok: false, needOcr: false, code: 'OCR_MANUAL_REVIEW', message: 'Número máximo de tentativas de OCR atingido.', extractionMethod: 'tika', ocrStatus: 'MANUAL_REVIEW', ocrQualityGrade: 'MANUAL_REVIEW', ocrReviewReason: 'MAX_ATTEMPTS' }, 'MANUAL_REVIEW');
}
if (activeOcrCount >= 1 && currentOcrStatus !== 'PROCESSING') {
  return result({ ok: false, needOcr: false, code: 'OCR_BUSY', message: 'Já existe um processamento de OCR em andamento.', retryable: true, extractionMethod: null, ocrStatus: 'OCR_BUSY' }, 'BUSY');
}
return result({ ok: true, needOcr: true, needReason: needDecision.reason }, 'PROCEED');
`;

const pos = `${lib}

const upd = $('Atualizar versão sucesso OCR').first().json;
const val = $('Validar OCR').first().json;
const av = $('Avaliar').first().json;
const tika = $input.first().json || {};
let data = tika.data ?? tika.body ?? tika;
if (data && typeof data === 'object' && data.data != null && typeof data.data === 'string') data = data.data;
const text = typeof data === 'string' ? data : (data == null ? '' : String(data));

const pageCount = Math.max(1, Number(av.pageCount || av.ocrPageCount || 1));
const quality = evaluateDocumentQuality(text, { pageCount });
const ocrAttempts = Number(val.ocrAttempts || av.ocrAttempts || 1);
const maxAttempts = Number(val.maxAttempts || av.maxAttempts || 3);
const decision = decidePostOcrAction(quality, ocrAttempts, maxAttempts);
const ocrMode = val.ocrMode || av.ocrMode || (ocrAttempts >= 2 ? 'HIGH_QUALITY' : 'STANDARD');

return [{ json: {
  ok: decision.action === 'SUCCESS',
  action: decision.action,
  needOcr: true,
  extractedText: quality.normalizedText,
  textLength: quality.metrics.characterCount,
  extractionMethod: 'ocr',
  ocrStatus: decision.ocrStatus,
  versionId: upd.versionId || val.versionId,
  documentId: upd.documentId || val.documentId,
  requestId: val.requestId,
  userId: val.userId,
  sessionId: val.sessionId,
  ocrEngine: val.engine,
  ocrLanguages: val.languages,
  ocrDurationMs: val.durationMs,
  ocrAttempts,
  ocrMode,
  ocrQualityScore: quality.score,
  ocrQualityGrade: decision.qualityGrade,
  ocrQualityReason: buildQualityReason(quality),
  ocrReviewReason: decision.reviewReason,
  ocrWordCount: quality.metrics.wordCount,
  ocrUniqueWordCount: quality.metrics.uniqueWordCount,
  ocrCharacterCount: quality.metrics.characterCount,
  ocrCharactersPerPage: quality.metrics.charsPerPage,
  ocrQualityMetrics: quality.metrics,
  code: decision.action === 'SUCCESS' ? null : (decision.action === 'HIGH_QUALITY_RETRY' ? 'OCR_HIGH_QUALITY_RETRY' : 'OCR_MANUAL_REVIEW'),
} }];
`;

fs.mkdirSync('tmp/ocr/etapa15', { recursive: true });
fs.writeFileSync('tmp/ocr/etapa15/avaliar.js', avaliar);
fs.writeFileSync('tmp/ocr/etapa15/avaliar-pos-ocr.js', pos);
console.log('ok', avaliar.length, pos.length);
