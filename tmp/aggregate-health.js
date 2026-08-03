const prep = $('Finalize storage').first().json || {};
const partial = prep._partial || {};
const tikaItem = $('Probe Tika').first().json || {};
const tikaStarted = Number(prep.tikaStartedAtMs || Date.now());
const tikaDuration = Math.max(0, Date.now() - tikaStarted);
const statusCode = Number(tikaItem.statusCode ?? tikaItem.status ?? 0);
const tikaOk = Number.isFinite(statusCode) && statusCode >= 200 && statusCode < 400;
const tika = { status: tikaOk ? 'ok' : 'degraded', durationMs: tikaDuration };
const ocrItem = $('Probe OCR').first().json || {};
const ocrDb = partial.ocrDb || { processing: 0, failed: 0, pending: 0, manualReview: 0, stuck: 0, avgDurationMs: null, avgQualityScore: null, excellentCount: 0, goodCount: 0, acceptableCount: 0, poorCount: 0, manualReviewCount: 0, avgAttempts: null };
const ocrStatusCode = Number(ocrItem.statusCode ?? ocrItem.status ?? 0);
const ocrAvailable = Number.isFinite(ocrStatusCode) && ocrStatusCode >= 200 && ocrStatusCode < 400;
let ocrBody = ocrItem.data ?? ocrItem.body ?? ocrItem;
if (typeof ocrBody === 'string') {
  try { ocrBody = JSON.parse(ocrBody); } catch (_) { ocrBody = {}; }
}
if (!ocrBody || typeof ocrBody !== 'object' || Array.isArray(ocrBody)) ocrBody = {};
const ocrVersion = ocrBody.version || ocrBody.engine || null;
const ocrLanguages = ocrBody.languages || ocrBody.langs || null;
const ocrDegraded = ocrDb.stuck > 0 || ocrDb.failed > 0 || ocrDb.manualReview > 0;
const ocr = {
  status: !ocrAvailable ? 'down' : (ocrDegraded ? 'degraded' : 'ok'),
  available: ocrAvailable,
  version: ocrVersion,
  languages: ocrLanguages,
  queue: ocrDb.processing,
  failures: ocrDb.failed,
  pending: ocrDb.pending,
  avgDurationMs: ocrDb.avgDurationMs,
  stuck: ocrDb.stuck,
  avgQualityScore: ocrDb.avgQualityScore,
  excellentCount: ocrDb.excellentCount,
  goodCount: ocrDb.goodCount,
  acceptableCount: ocrDb.acceptableCount,
  poorCount: ocrDb.poorCount,
  manualReviewCount: ocrDb.manualReviewCount,
  avgAttempts: ocrDb.avgAttempts,
};
const tabularItem = $input.first().json || {};
const tabularDb = partial.tabularDb || { processedCount: 0, failCount: 0, avgDurationMs: null, sheetCount: 0, rowCount: 0, chunkCount: 0 };
const tabularStatusCode = Number(tabularItem.statusCode ?? tabularItem.status ?? 0);
const tabularAvailable = Number.isFinite(tabularStatusCode) && tabularStatusCode >= 200 && tabularStatusCode < 400;
const tabularDegraded = tabularDb.failCount > 0;
const tabular = {
  status: !tabularAvailable ? 'down' : (tabularDegraded ? 'degraded' : 'ok'),
  available: tabularAvailable,
  processedCount: tabularDb.processedCount,
  failCount: tabularDb.failCount,
  avgDurationMs: tabularDb.avgDurationMs,
  sheetCount: tabularDb.sheetCount,
  rowCount: tabularDb.rowCount,
  chunkCount: tabularDb.chunkCount,
};
const documentsPartial = partial.documents || { status: 'down' };
const components = {
  n8n: partial.n8n || { status: 'ok', durationMs: 1 },
  database: partial.database || { status: 'down', durationMs: 0 },
  storage: {
    status: (partial.storage && partial.storage.status) || 'down',
    durationMs: (partial.storage && partial.storage.durationMs) || 0,
    storageAvailable: !!(partial.storage && partial.storage.storageAvailable),
  },
  tika,
  ocr,
  tabular,
  configuration: { status: (partial.configuration && partial.configuration.status) || 'unknown', openai: 'unknown' },
  sessions: partial.sessions || { status: 'down' },
  audit: partial.audit || { status: 'down' },
  documents: {
    ...documentsPartial,
    files: documentsPartial.files || undefined,
  },
  backup: partial.backup || { status: 'unknown', lastBackupAt: null, lastBackupStatus: null, lastBackupType: null },
};
const statusRelevantKeys = ['n8n', 'database', 'storage', 'tika', 'ocr', 'tabular', 'configuration', 'sessions', 'audit', 'documents'];
const essentialDown = components.n8n.status === 'down' || components.database.status === 'down' || components.storage.status === 'down';
const anyDegraded = statusRelevantKeys.some((k) => components[k] && components[k].status === 'degraded');
const anyDown = statusRelevantKeys.some((k) => components[k] && components[k].status === 'down');
let status = 'ok';
if (essentialDown) status = 'down';
else if (anyDown || anyDegraded) status = 'degraded';
const httpStatus = status === 'down' ? 503 : 200;
return [{ json: { status, checkedAt: new Date().toISOString(), components, httpStatus, mode: prep.mode || 'detailed' } }];