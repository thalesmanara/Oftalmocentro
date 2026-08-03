const health = $input.first().json || {};
const norm = $('Normalizar request').first().json;
let userId = ''; let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
const comps = health.components || {};
const allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','embeddings','configuration','sessions','audit','documents','backup','aiEval','aiPrompts','qdrant','retrieval','retrievalPipeline'];
const components = {};
for (const key of allowedCompKeys) {
  if (!comps[key]) continue;
  const c = comps[key];
  const out = { status: c.status || 'unknown' };
  if (typeof c.durationMs === 'number') out.durationMs = c.durationMs;
  if (key === 'storage' && typeof c.storageAvailable === 'boolean') out.storageAvailable = c.storageAvailable;
  if (key === 'sessions' && typeof c.activeCount === 'number') out.activeCount = c.activeCount;
  if (key === 'configuration' && c.openai) out.openai = c.openai;
  if (key === 'ocr') {
    out.available = !!c.available;
    if (c.version) out.version = c.version;
    if (c.languages) out.languages = c.languages;
    out.queue = Number(c.queue || 0) || 0;
    out.failures = Number(c.failures || 0) || 0;
    out.pending = Number(c.pending || 0) || 0;
    out.avgDurationMs = c.avgDurationMs != null ? Number(c.avgDurationMs) : null;
    out.stuck = Number(c.stuck || 0) || 0;
    out.avgQualityScore = c.avgQualityScore != null ? Number(c.avgQualityScore) : null;
    out.excellentCount = Number(c.excellentCount || 0) || 0;
    out.goodCount = Number(c.goodCount || 0) || 0;
    out.acceptableCount = Number(c.acceptableCount || 0) || 0;
    out.poorCount = Number(c.poorCount || 0) || 0;
    out.manualReviewCount = Number(c.manualReviewCount || 0) || 0;
    out.avgAttempts = c.avgAttempts != null ? Number(c.avgAttempts) : null;
  }
  if (key === 'embeddings') {
    out.pending = Number(c.pending || 0) || 0;
    out.processing = Number(c.processing || 0) || 0;
    out.valid = Number(c.valid || 0) || 0;
    out.failed = Number(c.failed || 0) || 0;
    out.invalid = Number(c.invalid || 0) || 0;
    out.skipped = Number(c.skipped || 0) || 0;
    out.mismatched = Number(c.mismatched || 0) || 0;
    out.avgMs = c.avgMs != null ? Number(c.avgMs) : null;
  }
  if (key === 'tabular') {
    out.available = !!c.available;
    out.processedCount = Number(c.processedCount || 0) || 0;
    out.failCount = Number(c.failCount || 0) || 0;
    out.avgDurationMs = c.avgDurationMs != null ? Number(c.avgDurationMs) : null;
    out.sheetCount = Number(c.sheetCount || 0) || 0;
    out.rowCount = Number(c.rowCount || 0) || 0;
    out.chunkCount = Number(c.chunkCount || 0) || 0;
  }
  if (key === 'documents') {
    for (const f of ['total','processing','errors','missingFiles','processedWithoutChunks']) {
      if (typeof c[f] === 'number') out[f] = c[f];
    }
    if (c.versions && typeof c.versions === 'object') {
      out.versions = {
        status: c.versions.status || 'unknown',
        versionsTotal: Number(c.versions.versionsTotal || 0) || 0,
        orphanChunks: Number(c.versions.orphanChunks || 0) || 0,
        multiCurrent: Number(c.versions.multiCurrent || 0) || 0,
      };
    }
    if (c.files && typeof c.files === 'object') {
      out.files = {
        status: c.files.status || 'unknown',
        maxUploadSizeBytes: Number(c.files.maxUploadSizeBytes || 0) || 0,
        allowedExtensions: c.files.allowedExtensions,
        invalidRecent24h: Number(c.files.invalidRecent24h || 0) || 0,
        pendingValidating: Number(c.files.pendingValidating || 0) || 0,
        validUnprocessed: Number(c.files.validUnprocessed || 0) || 0,
        stuckValidating: Number(c.files.stuckValidating || 0) || 0,
      };
    }
  }
  if (key === 'backup') {
    if (c.lastBackupAt) out.lastBackupAt = c.lastBackupAt;
    if (c.lastBackupStatus) out.lastBackupStatus = c.lastBackupStatus;
    if (c.lastBackupType) out.lastBackupType = c.lastBackupType;
    if (typeof c.ageHours === 'number') out.ageHours = c.ageHours;
  }
  if (key === 'aiEval') {
    out.casesCount = Number(c.casesCount || 0) || 0;
    if (c.lastScore != null) out.lastScore = Number(c.lastScore);
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
    if (c.lastRunStatus) out.lastRunStatus = c.lastRunStatus;
    if (c.avgDurationMs != null) out.avgDurationMs = Number(c.avgDurationMs);
  }
  if (key === 'aiPrompts') {
    if (c.versionNumber != null) out.versionNumber = Number(c.versionNumber);
    if (c.modelName) out.modelName = c.modelName;
    if (c.publishedAt) out.publishedAt = c.publishedAt;
    if (c.validationScore != null) out.validationScore = Number(c.validationScore);
    out.draftCount = Number(c.draftCount || 0) || 0;
    out.publishedCount = Number(c.publishedCount || 0) || 0;
    out.missingPublished = !!c.missingPublished;
    out.multiplePublished = !!c.multiplePublished;
    // UI aliases (no content)
    if (c.versionNumber != null) out.activeVersion = String(c.versionNumber);
    if (c.modelName) out.model = c.modelName;
    out.draftsCount = Number(c.draftCount || 0) || 0;
  }
  components[key] = out;
}
return [{ json: {
  data: { status: health.status || 'down', checkedAt: health.checkedAt || new Date().toISOString(), components },
  asList: false,
  statusCode: health.httpStatus === 503 ? 503 : 200,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
}}];