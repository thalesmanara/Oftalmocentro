const r = $input.first().json || {};
const prep = $('Montar atualização do run').first().json || {};
const run = {
  id: r.id,
  startedAt: r.started_at,
  finishedAt: r.finished_at,
  durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
  status: r.status,
  triggeredBy: r.triggered_by,
  triggerMode: r.trigger_mode,
  totalCases: Number(r.total_cases || 0),
  passedCount: Number(r.passed_count || 0),
  failedCount: Number(r.failed_count || 0),
  errorCount: Number(r.error_count || 0),
  skippedCount: Number(r.skipped_count || 0),
  overallScore: r.overall_score != null ? Number(r.overall_score) : null,
  promptVersion: r.prompt_version || null,
  promptVersionId: r.prompt_version_id || null,
  modelName: r.model_name || null,
  ocrEngineVersion: r.ocr_engine_version || null,
  tabularEngineVersion: r.tabular_engine_version || null,
  report: r.report || {},
  metadata: r.metadata || {},
  createdAt: r.created_at,
};
return [{ json: { run, metrics: prep.metrics || null, results: prep.results || [] } }];