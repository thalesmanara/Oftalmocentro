import { workflow, node, trigger, expr, newCredential, splitInBatches, nextBatch } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'authorization', type: 'string' },
          { name: 'triggeredBy', type: 'string' },
          { name: 'groupName', type: 'string' },
          { name: 'includeMissingDocs', type: 'boolean' },
          { name: 'caseId', type: 'string' },
          { name: 'caseCode', type: 'string' },
          { name: 'triggerMode', type: 'string' },
        ],
      },
    },
    output: [
      {
        json: {
          authorization: 'Bearer x',
          triggeredBy: '55555555-5555-5555-5555-555555555555',
          groupName: '',
          includeMissingDocs: false,
          caseId: '',
          caseCode: '',
          triggerMode: 'dataset',
        },
      },
    ],
  },
});

const inserirRun = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir run',
    credentials: { postgres: PG_CRED },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version)\n' +
          'VALUES (\n' +
          "  'STARTED',\n" +
          "  NULLIF('{{ $json.triggeredBy || \"\" }}', '')::uuid,\n" +
          "  '{{ String($json.triggerMode || \"dataset\").replace(/'/g, \"''\") }}',\n" +
          "  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_prompt_version' LIMIT 1), 'unknown'),\n" +
          "  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_model_name' LIMIT 1), 'unknown'),\n" +
          "  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_ocr_engine_version' LIMIT 1), 'n/a'),\n" +
          "  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_tabular_engine_version' LIMIT 1), 'n/a')\n" +
          ')\n' +
          'RETURNING id, started_at, status, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, triggered_by;'
      ),
    },
  },
  output: [
    {
      json: {
        id: '11111111-1111-1111-1111-111111111111',
        started_at: '2026-08-03T00:00:00.000Z',
        status: 'STARTED',
        trigger_mode: 'dataset',
        prompt_version: 'consulta-ia-v1',
        model_name: 'gpt-4.1-mini',
        ocr_engine_version: 'n/a',
        tabular_engine_version: 'n/a',
        triggered_by: '55555555-5555-5555-5555-555555555555',
      },
    },
  ],
});

const montarFiltro = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar filtro de casos',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const trigIn = $('Trigger').first().json || {};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const conditions = ["status = 'active'"];
if (!trigIn.includeMissingDocs) conditions.push('depends_on_missing_docs = false');
if (trigIn.groupName) conditions.push("group_name = '" + esc(trigIn.groupName) + "'");
if (trigIn.caseId) conditions.push("id = '" + esc(trigIn.caseId) + "'::uuid");
else if (trigIn.caseCode) conditions.push("code = '" + esc(trigIn.caseCode) + "'");
const sql = "SELECT id, code, name, group_name, test_type, category_name, subcategory_name, expected_document_id,\\n" +
  "  expected_document_ids, question, expected_answer, required_words, forbidden_words,\\n" +
  "  required_source_document_id, min_score, expect_no_answer, notes, status, version, depends_on_missing_docs\\n" +
  "FROM ai_test_cases\\n" +
  "WHERE " + conditions.join(' AND ') + "\\n" +
  "ORDER BY code ASC;";
return [{ json: { sql } }];`,
    },
  },
  output: [{ json: { sql: "SELECT id FROM ai_test_cases WHERE status = 'active';" } }],
});

const carregarCasos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar casos',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [
    {
      json: {
        id: '22222222-2222-2222-2222-222222222222',
        code: 'TC-001',
        name: 'Caso 1',
        group_name: 'GRUPO_A',
        test_type: 'FACTUAL',
        question: 'Pergunta?',
        required_words: [],
        forbidden_words: [],
        min_score: 70,
        expect_no_answer: false,
        depends_on_missing_docs: false,
      },
    },
  ],
});

const loopCasos = splitInBatches({
  version: 3,
  config: { name: 'Loop casos', parameters: { batchSize: 1 } },
});

const executarCaso = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Executar caso',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'KdpEmEGHNlPICOa4', cachedResultName: 'IA - EXECUTAR TESTE' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          runId: expr("={{ $('Inserir run').first().json.id }}"),
          caseId: expr('={{ $json.id }}'),
          authorization: expr("={{ $('Trigger').first().json.authorization }}"),
          promptVersion: expr("={{ $('Inserir run').first().json.prompt_version }}"),
          modelName: expr("={{ $('Inserir run').first().json.model_name }}"),
          refusalPhrase: '',
          maxLatencyMs: expr('={{ 0 }}'),
        },
      },
    },
  },
  output: [{ json: { ok: true, result: { verdict: 'PASS', score: 80 }, verdict: 'PASS', score: 80 } }],
});

const calcularMetricas = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Calcular métricas',
    executeOnce: true,
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: '1uITQcJ5jSNXErOM', cachedResultName: 'IA - CALCULAR MÉTRICAS' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { runId: expr("={{ $('Inserir run').first().json.id }}") },
      },
    },
  },
  output: [{ json: { id: '44444444-4444-4444-4444-444444444444', runId: '11111111-1111-1111-1111-111111111111', totalCount: 1, passedCount: 1, failedCount: 0, internalErrorCount: 0, overallScore: 80 } }],
});

const gerarRelatorio = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Gerar relatório',
    parameters: {
      mode: 'once',
      options: { waitForSubWorkflow: true },
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: 'DoaDLe6P5BtJhDXb', cachedResultName: 'IA - GERAR RELATÓRIO' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: { runId: expr("={{ $('Inserir run').first().json.id }}") },
      },
    },
  },
  output: [{ json: { total: 1, passed: 1, failed: 0, errors: 0, overallScore: 80 } }],
});

const carregarResultadosFinais = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar resultados finais',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr("SELECT * FROM ai_test_results WHERE run_id = '{{ $('Inserir run').first().json.id }}'::uuid ORDER BY created_at ASC;"),
    },
  },
  output: [
    {
      json: {
        id: '33333333-3333-3333-3333-333333333333',
        run_id: '11111111-1111-1111-1111-111111111111',
        case_id: '22222222-2222-2222-2222-222222222222',
        case_code: 'TC-001',
        question: 'Pergunta?',
        answer: 'Resposta',
        duration_ms: 5000,
        sources: [],
        chunk_refs: [],
        verdict: 'PASS',
        score: 80,
      },
    },
  ],
});

const montarAtualizacao = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar atualização do run',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const startedRow = $('Inserir run').first().json;
const metrics = $('Calcular métricas').first().json || {};
const rows = $('Carregar resultados finais').all().map((i) => i.json).filter((r) => r && r.id);
const totalCount = Number(metrics.totalCount || 0);
const passedCount = Number(metrics.passedCount || 0);
const failedCount = Number(metrics.failedCount || 0);
const internalErrorCount = Number(metrics.internalErrorCount || 0);
let status;
if (totalCount === 0) status = 'FAILED';
else if (failedCount === 0 && internalErrorCount === 0) status = 'SUCCESS';
else if (passedCount > 0) status = 'PARTIAL';
else status = 'FAILED';
const startedAt = new Date(startedRow.started_at);
const finishedAt = new Date();
const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const sql = "UPDATE ai_test_runs SET status = '" + esc(status) + "', finished_at = '" + finishedAt.toISOString() + "'::timestamp, duration_ms = " + durationMs + " WHERE id = '" + esc(startedRow.id) + "'::uuid RETURNING id, started_at, finished_at, duration_ms, status, triggered_by, trigger_mode, total_cases, passed_count, failed_count, error_count, skipped_count, overall_score, prompt_version, model_name, ocr_engine_version, tabular_engine_version, report, metadata, created_at;";
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
const results = rows.map(camelResult);
return [{ json: { sql, results, metrics } }];`,
    },
  },
  output: [{ json: { sql: "UPDATE ai_test_runs SET status = 'SUCCESS' WHERE id = '11111111-1111-1111-1111-111111111111'::uuid RETURNING id;", results: [], metrics: { totalCount: 1 } } }],
});

const atualizarRun = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar run',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [
    {
      json: {
        id: '11111111-1111-1111-1111-111111111111',
        started_at: '2026-08-03T00:00:00.000Z',
        finished_at: '2026-08-03T00:05:00.000Z',
        duration_ms: 300000,
        status: 'SUCCESS',
        triggered_by: '55555555-5555-5555-5555-555555555555',
        trigger_mode: 'dataset',
        total_cases: 1,
        passed_count: 1,
        failed_count: 0,
        error_count: 0,
        skipped_count: 0,
        overall_score: 80,
        prompt_version: 'consulta-ia-v1',
        model_name: 'gpt-4.1-mini',
        ocr_engine_version: 'n/a',
        tabular_engine_version: 'n/a',
        report: {},
        metadata: {},
        created_at: '2026-08-03T00:00:00.000Z',
      },
    },
  ],
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const r = $input.first().json || {};
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
  modelName: r.model_name || null,
  ocrEngineVersion: r.ocr_engine_version || null,
  tabularEngineVersion: r.tabular_engine_version || null,
  report: r.report || {},
  metadata: r.metadata || {},
  createdAt: r.created_at,
};
return [{ json: { run, metrics: prep.metrics || null, results: prep.results || [] } }];`,
    },
  },
  output: [{ json: { run: { id: '11111111-1111-1111-1111-111111111111', status: 'SUCCESS' }, metrics: { totalCount: 1 }, results: [] } }],
});

export default workflow('ia-executar-dataset', 'IA - EXECUTAR DATASET')
  .add(trig)
  .to(inserirRun)
  .to(montarFiltro)
  .to(carregarCasos)
  .to(
    loopCasos
      .onEachBatch(executarCaso.to(nextBatch(loopCasos)))
      .onDone(
        calcularMetricas
          .to(gerarRelatorio)
          .to(carregarResultadosFinais)
          .to(montarAtualizacao)
          .to(atualizarRun)
          .to(montarResposta)
      )
  );
