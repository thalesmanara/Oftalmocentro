contextWindow: (() => {
    const c = partial.contextDb || {};
    const published = Number(c.published || 0);
    const secretsMatch = c.secretsMatch !== false;
    const multiple = published > 1;
    const fallbacks = Number(c.fallbackCount || 0);
    let status = 'ok';
    if (multiple || !secretsMatch || Number(c.invalidCount || 0) > 0) status = 'degraded';
    return {
      status,
      activeMode: c.mode || 'LEGACY',
      activeVersion: c.version || 'context-v1',
      modelName: 'gpt-4.1-mini',
      avgAvailableTokens: null,
      avgUsedTokens: null,
      avgUtilizationRate: null,
      avgIncludedChunks: null,
      avgExcludedChunks: null,
      overflowCount7d: 0,
      fallbackCount7d: fallbacks,
      failureCount7d: 0,
      insufficientContextCount7d: 0,
      avgBuildLatencyMs: null,
      lastDatasetValidation: c.lastValidationAt || null,
      lastValidationRun: c.lastValidationAt || null,
      lastValidationScore: c.lastScore != null ? Number(c.lastScore) : null,
      secretsMatchPublished: secretsMatch,
      multiplePublishedCount: Math.max(0, published > 1 ? published : 0),
      invalidConfigCount: Number(c.invalidCount || 0),
      draftCount: Number(