const ctx = $('Montar contexto').first().json;
const prompt = $('Aplicar prompt carregado').first().json || {};
const answer = $json.output?.[0]?.content?.[0]?.text ?? '';
const sources = (ctx.sources || []).map((s) => ({
  ...s,
  expirationDate: s.expirationDate ?? s.vigencyDate ?? null,
}));
const requestId = $('Normalizar request').first().json.requestId;
let rankingMeta = null;
let rankedDocumentIds = [];
let fallbackUsed = false;
let retrievalConfigVersion = null;
let modeOverrideUsed = false;
try {
  const ranked = $('Resolver ranking final').all().map(i => i.json).filter(Boolean);
  if (ranked.length) {
    rankingMeta = ranked[0].rankingMetadata || null;
    fallbackUsed = !!ranked[0].fallbackUsed || !!(rankingMeta && rankingMeta.fallbackUsed);
    retrievalConfigVersion = ranked[0].retrievalConfigVersion || (rankingMeta && rankingMeta.versionLabel) || null;
    rankedDocumentIds = ranked.map(r => r.documentId || r.document_id).filter(Boolean);
  }
} catch (_) {}
try {
  const cfg = $('Carregar retrieval config').first().json || {};
  modeOverrideUsed = !!cfg.modeOverrideUsed;
  if (!retrievalConfigVersion) retrievalConfigVersion = cfg.versionLabel || null;
} catch (_) {}
const retrievalMeta = {
  mode: (rankingMeta && rankingMeta.mode) || null,
  versionLabel: retrievalConfigVersion,
  candidateCount: rankingMeta && rankingMeta.candidateCount != null ? Number(rankingMeta.candidateCount) : null,
  selectedCount: rankingMeta && rankingMeta.selectedCount != null ? Number(rankingMeta.selectedCount) : rankedDocumentIds.length,
  durationMs: rankingMeta && rankingMeta.durationMs != null ? Number(rankingMeta.durationMs) : null,
  fallbackUsed,
  modeOverrideUsed,
  rankedDocumentIds,
};
return [{
  json: {
    data: {
      question: ctx.question,
      answer,
      sources,
      classification: ctx.classification,
      retrievalMeta,
    },
    statusCode: 200,
    requestId,
    promptMeta: {
      promptVersionId: prompt.promptVersionId || null,
      promptCode: prompt.promptCode || null,
      versionNumber: prompt.versionNumber != null ? prompt.versionNumber : null,
      contentHash: prompt.contentHash || null,
      modelName: prompt.modelName || null,
    },
  },
}];