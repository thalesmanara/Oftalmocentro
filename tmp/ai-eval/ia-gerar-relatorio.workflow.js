import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [{ name: 'runId', type: 'string' }] },
    },
    output: [{ json: { runId: '11111111-1111-1111-1111-111111111111' } }],
  },
});

const carregarDados = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar run e métricas',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'SELECT r.id AS run_id, r.status AS run_status, r.total_cases, r.passed_count AS run_passed_count,\n' +
          '  r.failed_count AS run_failed_count, r.error_count AS run_error_count, r.overall_score AS run_overall_score,\n' +
          '  m.precision, m.recall, m.document_coverage, m.category_coverage, m.avg_duration_ms, m.min_duration_ms,\n' +
          '  m.max_duration_ms, m.top_errors, m.top_documents, m.score_formula, m.overall_score AS metrics_overall_score,\n' +
          '  m.total_count, m.passed_count AS metrics_passed_count, m.failed_count AS metrics_failed_count,\n' +
          '  m.internal_error_count\n' +
          'FROM ai_test_runs r\n' +
          'LEFT JOIN ai_test_metrics m ON m.run_id = r.id\n' +
          "WHERE r.id = '{{ $json.runId }}'::uuid\n" +
          'LIMIT 1;'
      ),
    },
  },
  output: [
    {
      json: {
        run_id: '11111111-1111-1111-1111-111111111111',
        run_status: 'SUCCESS',
        total_cases: 1,
        run_passed_count: 1,
        run_failed_count: 0,
        run_error_count: 0,
        run_overall_score: 80,
        precision: 80,
        recall: 75,
        document_coverage: 90,
        category_coverage: {},
        avg_duration_ms: 5000,
        min_duration_ms: 1000,
        max_duration_ms: 9000,
        top_errors: [],
        top_documents: [],
        score_formula: 'formula',
        metrics_overall_score: 80,
        total_count: 1,
        metrics_passed_count: 1,
        metrics_failed_count: 0,
        internal_error_count: 0,
      },
    },
  ],
});

const montarRelatorio = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar relatório',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const total = Number(row.total_count ?? row.total_cases ?? 0);
const passed = Number(row.metrics_passed_count ?? row.run_passed_count ?? 0);
const failed = Number(row.metrics_failed_count ?? row.run_failed_count ?? 0);
const errors = Number(row.internal_error_count ?? row.run_error_count ?? 0);
const report = {
  total,
  passed,
  failed,
  errors,
  precision: row.precision != null ? Number(row.precision) : null,
  recall: row.recall != null ? Number(row.recall) : null,
  documentCoverage: row.document_coverage != null ? Number(row.document_coverage) : null,
  categoryCoverage: row.category_coverage || {},
  topErrors: row.top_errors || [],
  topDocuments: row.top_documents || [],
  avgDurationMs: row.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
  minDurationMs: row.min_duration_ms != null ? Number(row.min_duration_ms) : null,
  maxDurationMs: row.max_duration_ms != null ? Number(row.max_duration_ms) : null,
  overallScore: row.metrics_overall_score != null ? Number(row.metrics_overall_score) : (row.run_overall_score != null ? Number(row.run_overall_score) : null),
  scoreFormula: row.score_formula || 'Per-case: answerQuality40 + sources30 + document20 + latency10. Run overall = average(case scores). Precision = passed/total.',
  generatedAt: new Date().toISOString(),
};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const sql = "UPDATE ai_test_runs SET report = '" + esc(JSON.stringify(report)) + "'::jsonb WHERE id = '" + esc(row.run_id) + "'::uuid RETURNING report;";
return [{ json: { sql, report, runId: row.run_id } }];`,
    },
  },
  output: [{ json: { sql: "UPDATE ai_test_runs SET report = '{}'::jsonb WHERE id = '11111111-1111-1111-1111-111111111111'::uuid RETURNING report;", report: { total: 1 }, runId: '11111111-1111-1111-1111-111111111111' } }],
});

const atualizarRun = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar relatório do run',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [{ json: { report: { total: 1, passed: 1, failed: 0, errors: 0 } } }],
});

const retornar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Retornar relatório',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const dbRow = $input.first().json || {};
const built = $('Montar relatório').first().json.report;
return [{ json: (dbRow && dbRow.report) ? dbRow.report : built }];`,
    },
  },
  output: [{ json: { total: 1, passed: 1, failed: 0, errors: 0, overallScore: 80 } }],
});

export default workflow('ia-gerar-relatorio', 'IA - GERAR RELATÓRIO')
  .add(trig)
  .to(carregarDados)
  .to(montarRelatorio)
  .to(atualizarRun)
  .to(retornar);
