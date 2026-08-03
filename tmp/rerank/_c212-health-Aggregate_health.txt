try {
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
  aiEval: (() => {
    const a = partial.aiEvalDb || { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null };
    const status = a.casesCount > 0 ? 'ok' : 'degraded';
    return {
      status,
      casesCount: a.casesCount,
      lastScore: a.lastScore,
      lastRunAt: a.lastRunAt,
      lastRunStatus: a.lastRunStatus,
      avgDurationMs: a.avgDurationMs,
    };
  })(),
  contextWindow: (() => {
    return {
      status: 'up',
      activeMode: 'LEGACY',
      activeVersion: 'context-v1',
      modelName: 'gpt-4.1-mini',
      avgAvailableTokens: null,
      avgUsedTokens: null,
      avgUtilizationRate: null,
      avgIncludedChunks: null,
      avgExcludedChunks: null,
      overflowCount7d: 0,
      fallbackCount7d: 0,
      failureCount7d: 0,
      insufficientContextCount7d: 0,
      avgBuildLatencyMs: null,
      lastDatasetValidation: null,
      draftCount: 1,
    };
  })(),
  retrievalPipeline: (() => {
    const r = partial.retrievalDb || {};
    const q = partial.qdrantDb || partial.components?.qdrant || {};
    const emb = partial.embeddingsDb || {};
    const fallbacks = Number(r.fallbackCount || 0);
    const textOk = true;
    const vectorOk = q.online !== false && (q.status === 'up' || q.status === 'ok' || q.online === true || q.available !== false);
    return {
      status: fallbacks >= 20 ? 'degraded' : 'up',
      activeMode: r.mode || 'HYBRID',
      activeVersion: r.version || 'hybrid-v1',
      textSearchAvailable: textOk,
      vectorSearchAvailable: !!vectorOk,
      rerankAvailable: true,
      avgRetrievalLatencyMs: r.avgRetrievalMs != null ? Number(r.avgRetrievalMs) : null,
      avgRerankLatencyMs: r.avgRerankMs != null ? Number(r.avgRerankMs) : null,
      fallbackCount7d: fallbacks,
      failureCount7d: Number(r.failureCount || 0),
      avgCandidates: r.avgCandidates != null ? Number(r.avgCandidates) : null,
      avgSelected: r.avgFinal != null ? Number(r.avgFinal) : null,
      lastSuccessfulRetrieval: r.lastSuccessAt || null,
      lastDatasetValidation: r.lastValidationAt || null,
    };
  })(),
  retrieval: (() => {
    const r = partial.retrievalDb || {};
    const fallbacks = Number(r.fallbackCount || 0);
    let status = 'ok';
    if (fallbacks >= 20) status = 'degraded';
    return {
      status,
      mode: r.mode || 'HYBRID',
      activeVersion: r.version || null,
      draftsCount: Number(r.drafts || 0),
      avgDurationMs: r.avgRerankMs,
      failures: fallbacks,
      pending: Number(r.avgCandidates || 0),
      queue: Number(r.avgFinal || 0),
      lastRunAt: r.lastValidationAt || null,
      online: r.available !== false,
      details: {
        candidateAvg: r.avgCandidates,
        finalAvg: r.avgFinal,
        fallbackCount7d: fallbacks,
        rerankAvailable: true,
      },
    };
  })(),
  qdrant: (() => {
    const q = partial.qdrantDb || { synced: 0, pending: 0, failed: 0, avgMs: null, lastSync: null };
    let online = false; let points = 0; let collection = 'oftalmocentro_chunks';
    try {
      const pr = $('Probe Qdrant').first().json || {};
      const code = Number(pr.statusCode ?? pr.status ?? 0);
      let body = pr.body ?? pr;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      online = code >= 200 && code < 300 && body.status === 'ok';
      points = Number(body.result && body.result.points_count) || 0;
    } catch (_) {}
    const degraded = !online || q.failed > 0 || q.pending > 0;
    return {
      status: !online ? 'down' : (degraded ? 'degraded' : 'ok'),
      online, collection, total: points, pending: q.pending, failures: q.failed,
      avgDurationMs: q.avgMs, lastRunAt: q.lastSync, model: 'text-embedding-3-small',
    };
  })(),
  embeddings: (() => {
    const e = partial.embeddingsDb || { pending: 0, processing: 0, valid: 0, failed: 0, invalid: 0, skipped: 0, mismatched: 0, avgMs: null };
    const degraded = e.failed > 0 || e.invalid > 0 || e.mismatched > 0 || e.processing > 0;
    const status = e.pending > 0 && e.valid === 0 && e.failed === 0 ? 'degraded' : (degraded ? 'degraded' : 'ok');
    return {
      status,
      pending: e.pending,
      processing: e.processing,
      valid: e.valid,
      failed: e.failed,
      invalid: e.invalid,
      skipped: e.skipped,
      mismatched: e.mismatched,
      avgMs: e.avgMs,
    };
  })(),
  aiPrompts: (() => {
    const a = partial.aiPromptsDb || { status: 'degraded', versionNumber: null, modelName: null, publishedAt: null, validationScore: null, draftCount: 0, publishedCount: 0, missingPublished: true, multiplePublished: false };
    return {
      status: a.status || 'degraded',
      versionNumber: a.versionNumber,
      modelName: a.modelName,
      publishedAt: a.publishedAt,
      validationScore: a.validationScore,
      draftCount: Number(a.draftCount || 0) || 0,
      publishedCount: Number(a.publishedCount || 0) || 0,
      missingPublished: !!a.missingPublished,
      multiplePublished: !!a.multiplePublished,
    };
  })(),
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
} catch (err) {
  return [{ json: { status: 'down', checkedAt: new Date().toISOString(), components: { n8n: { status: 'ok' }, database: { status: 'down' } }, httpStatus: 503, AGG_CATCH: String(err && err.message || err) } }];
}