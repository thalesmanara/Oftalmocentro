import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const respondHeaders = {
  entries: [
    { name: 'X-Request-Id', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}' },
    { name: 'X-Response-Time-Ms', value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}' },
  ],
};

const restoreJs = "return [$('Normalizar request').first()];";

const runQuery =
  "SELECT * FROM ai_test_runs WHERE id = NULLIF('{{ String($json.query.runId || \"\").replace(/'/g, \"''\") }}', '')::uuid LIMIT 1;";

const metricsQuery =
  "SELECT * FROM ai_test_metrics WHERE run_id = NULLIF('{{ String($('Normalizar request').first().json.query.runId || \"\").replace(/'/g, \"''\") }}', '')::uuid LIMIT 1;";

const resultsQuery =
  "SELECT * FROM ai_test_results WHERE run_id = NULLIF('{{ String($('Normalizar request').first().json.query.runId || \"\").replace(/'/g, \"''\") }}', '')::uuid ORDER BY created_at ASC;";

const collectJs = `const norm = $('Normalizar request').first().json;
const runId = (norm.query || {}).runId || '';
const runRows = $('Carregar run').all().map((i) => i.json).filter((j) => j && j.id);
const metricsRows = $('Carregar métricas').all().map((i) => i.json).filter((j) => j && j.id);
const resultRows = $('Carregar resultados').all().map((i) => i.json).filter((j) => j && j.id);

function camelRun(r) {
  return {
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
    modelName: r.model_name || null,
    ocrEngineVersion: r.ocr_engine_version || null,
    tabularEngineVersion: r.tabular_engine_version || null,
    report: r.report || {},
    metadata: r.metadata || {},
    createdAt: r.created_at,
  };
}
function camelMetrics(m) {
  return {
    id: m.id,
    runId: m.run_id,
    precision: m.precision != null ? Number(m.precision) : null,
    recall: m.recall != null ? Number(m.recall) : null,
    documentCoverage: m.document_coverage != null ? Number(m.document_coverage) : null,
    categoryCoverage: m.category_coverage || {},
    avgDurationMs: m.avg_duration_ms != null ? Number(m.avg_duration_ms) : null,
    minDurationMs: m.min_duration_ms != null ? Number(m.min_duration_ms) : null,
    maxDurationMs: m.max_duration_ms != null ? Number(m.max_duration_ms) : null,
    sourcesCorrectCount: Number(m.sources_correct_count || 0),
    sourcesIncorrectCount: Number(m.sources_incorrect_count || 0),
    documentCorrectCount: Number(m.document_correct_count || 0),
    categoryCorrectCount: Number(m.category_correct_count || 0),
    subcategoryCorrectCount: Number(m.subcategory_correct_count || 0),
    hallucinationCount: Number(m.hallucination_count || 0),
    emptyAnswerCount: Number(m.empty_answer_count || 0),
    internalErrorCount: Number(m.internal_error_count || 0),
    passedCount: Number(m.passed_count || 0),
    failedCount: Number(m.failed_count || 0),
    totalCount: Number(m.total_count || 0),
    overallScore: m.overall_score != null ? Number(m.overall_score) : null,
    topErrors: m.top_errors || [],
    topDocuments: m.top_documents || [],
    scoreFormula: m.score_formula || null,
    createdAt: m.created_at,
  };
}
function camelResult(r) {
  return {
    id: r.id,
    runId: r.run_id,
    caseId: r.case_id,
    caseCode: r.case_code,
    question: r.question,
    answer: r.answer,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    sources: r.sources || [],
    chunkRefs: r.chunk_refs || [],
    classification: r.classification || null,
    matchedDocument: r.matched_document,
    matchedCategory: r.matched_category,
    matchedSubcategory: r.matched_subcategory,
    requiredWordsHit: Number(r.required_words_hit || 0),
    requiredWordsTotal: Number(r.required_words_total || 0),
    forbiddenWordsHit: Number(r.forbidden_words_hit || 0),
    sourcesCorrect: r.sources_correct,
    sourcesIncorrect: r.sources_incorrect,
    isHallucination: !!r.is_hallucination,
    isEmptyAnswer: !!r.is_empty_answer,
    isInternalError: !!r.is_internal_error,
    score: r.score != null ? Number(r.score) : null,
    verdict: r.verdict,
    scoreBreakdown: r.score_breakdown || null,
    extractionMethod: r.extraction_method || null,
    ocrQualityGrade: r.ocr_quality_grade || null,
    ocrUsed: r.ocr_used,
    sheetName: r.sheet_name || null,
    promptVersion: r.prompt_version || null,
    modelName: r.model_name || null,
    createdAt: r.created_at,
  };
}
const run = runRows.length ? camelRun(runRows[0]) : null;
const metrics = metricsRows.length ? camelMetrics(metricsRows[0]) : null;
const results = resultRows.map(camelResult);
const statusCode = run ? 200 : 404;
let userId = '';
let sessionId = '';
try { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}
return [{ json: {
  data: run ? { run, metrics, results, report: run.report || {} } : { error: 'RUN_NOT_FOUND' },
  asList: false,
  statusCode,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId,
  sessionId,
} }];`;

const webhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook',
    parameters: { path: 'system/ai-eval/runs/detail', responseMode: 'responseNode', options: {} },
  },
});

const normalizar = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Normalizar request',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - NORMALIZAR REQUEST', mode: 'id', value: 'N3zLpj7Dij4n5p5p' },
    },
  },
});

const validarAuth = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar auth',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'P5E43ZXSJiI9wFYD', cachedResultName: 'AUTH - VALIDAR TOKEN' },
      mode: 'once',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          authorization: "={{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}",
          requestId: "={{ $json.requestId || '' }}",
        },
      },
      options: { waitForSubWorkflow: true },
    },
  },
});

const authOk = ifElse({
  version: 2.3,
  config: {
    name: 'Auth ok?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{ id: 'a1', leftValue: '={{ $json.ok }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
        combinator: 'and',
      },
      looseTypeValidation: true,
    },
  },
});

const validarPerm = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Validar permissão',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'AUTH - VALIDAR PERMISSÃO', mode: 'id', value: 'yXW3rW8EbHXuprRJ' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          isMaster: '={{ $json.user ? $json.user.isMaster === true : false }}',
          permissions: '={{ $json.permissions || ($json.user && $json.user.permissions) || [] }}',
          requiredAnyOf: '={{ [] }}',
          requiredPermission: 'editar_configuracoes',
          sessionId: "={{ $json.sessionId || '' }}",
          user: '={{ $json.user || null }}',
          userId: "={{ $json.userId || ($json.user && $json.user.id) || '' }}",
          requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}",
        },
      },
    },
  },
});

const permOk = ifElse({
  version: 2.3,
  config: {
    name: 'Permissão ok?',
    parameters: {
      conditions: {
        combinator: 'and',
        conditions: [{ id: 'p1', leftValue: '={{ $json.ok }}', operator: { operation: 'true', type: 'boolean' }, rightValue: true }],
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      },
      looseTypeValidation: true,
    },
  },
});

const restaurar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurar request',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: restoreJs },
  },
});

const carregarRun = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar run',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(runQuery), options: {} },
  },
});

const carregarMetricas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar métricas',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(metricsQuery), options: {} },
  },
});

const carregarResultados = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar resultados',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', query: expr(resultsQuery), options: {} },
  },
});

const coletar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Coletar detalhe',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: collectJs },
  },
});

const prepararSucesso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar sucesso',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR SUCESSO', mode: 'id', value: 'zE5LRjZfbXw8Ymll' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          asList: '={{ $json.asList }}',
          data: '={{ $json.data }}',
          requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId }}",
          statusCode: '={{ $json.statusCode }}',
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
        },
      },
    },
  },
});

const preparar401 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 401',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: "={{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}",
          message: "={{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: 401,
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
        },
      },
    },
  },
});

const preparar403 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Preparar erro 403',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, cachedResultName: 'SYSTEM - PREPARAR ERRO', mode: 'id', value: 'r3iSBV1ClKOxS2UI' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          code: "={{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}",
          message: "={{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          statusCode: 403,
          requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
          method: "={{ $('Normalizar request').first().json.method }}",
          path: "={{ $('Normalizar request').first().json.path }}",
        },
      },
    },
  },
});

const respondOk = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond to Webhook',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: '={{ $json.statusCode }}', responseHeaders: respondHeaders },
    },
  },
});

const respond401 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 401',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 401, responseHeaders: respondHeaders },
    },
  },
});

const respond403 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond 403',
    parameters: {
      respondWith: 'json',
      responseBody: '={{ $json.response }}',
      options: { responseCode: 403, responseHeaders: respondHeaders },
    },
  },
});

const successPath = restaurar.to(carregarRun.to(carregarMetricas.to(carregarResultados.to(coletar.to(prepararSucesso.to(respondOk))))));

export default workflow('get-system-ai-eval-run-detail', 'GET System AI Eval Run Detail')
  .add(webhook)
  .to(normalizar)
  .to(validarAuth)
  .to(authOk.onTrue(validarPerm.to(permOk.onTrue(successPath).onFalse(preparar403.to(respond403)))).onFalse(preparar401.to(respond401)));
