const ctx = $('Aplicar janela de contexto').first().json;
const prompt = $('Aplicar prompt carregado').first().json || {};
const answer = $json.output?.[0]?.content?.[0]?.text ?? '';
const sources = (ctx.sources || []).map((s) => ({
  ...s,
  expirationDate: s.expirationDate ?? s.vigencyDate ?? null,
}));
const requestId = $('Normalizar request').first().json.requestId;
const retrievalMeta = ctx.retrievalMeta || null;
const contextMeta = ctx.contextMeta || null;
return [{
  json: {
    data: {
      question: ctx.question,
      answer,
      sources,
      classification: ctx.classification,
      retrievalMeta,
      contextMeta: contextMeta ? {
        mode: contextMeta.mode,
        configVersion: contextMeta.configVersion,
        configVersionId: contextMeta.configVersionId,
        estimatedContextTokens: contextMeta.estimatedContextTokens,
        availableContextTokens: contextMeta.availableContextTokens,
        includedChunkCount: contextMeta.includedChunkCount,
        excludedChunkCount: contextMeta.excludedChunkCount,
        includedDocumentCount: contextMeta.includedDocumentCount,
        truncated: contextMeta.truncated,
        insufficientContext: contextMeta.insufficientContext,
        conflictDetected: contextMeta.conflictDetected,
        redundancyRemovedCount: contextMeta.redundancyRemovedCount,
        neighborsAddedCount: contextMeta.neighborsAddedCount,
        fallbackUsed: contextMeta.fallbackUsed,
        fallbackReason: contextMeta.fallbackReason || null,
        durationMs: contextMeta.durationMs,
        modelName: contextMeta.modelName,
      } : null,
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