const norm = $('Normalizar request').first().json;
const dataset = $input.first().json || {};
const run = dataset.run || null;
const metrics = dataset.metrics || null;
const results = dataset.results || [];
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: { run, metrics, results },
  asList: false,
  statusCode: run ? 200 : 500,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
  runId: run ? run.id : null,
  runStatus: run ? run.status : 'FAILED',
  metricsTotalCount: metrics ? metrics.totalCount : null,
  metricsOverallScore: metrics ? metrics.overallScore : null,
  metricsPrecision: metrics ? metrics.precision : null,
  metricsRecall: metrics ? metrics.recall : null,
} }];