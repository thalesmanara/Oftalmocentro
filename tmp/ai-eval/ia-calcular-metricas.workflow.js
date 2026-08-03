import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const AGG_FN = `function aggregateMetrics(results){const total=results.length;const passed=results.filter(r=>r.verdict==='PASS').length;const failed=results.filter(r=>r.verdict==='FAIL').length;const errors=results.filter(r=>r.verdict==='ERROR').length;const durations=results.map(r=>Number(r.durationMs)).filter(n=>Number.isFinite(n));const scores=results.map(r=>Number(r.score)).filter(n=>Number.isFinite(n));const precision=total?Math.round((passed/total)*10000)/100:0;const answerable=results.filter(r=>!r.expectNoAnswer);const recall=answerable.length?Math.round((answerable.filter(r=>r.verdict==='PASS').length/answerable.length)*10000)/100:0;const docsExpected=new Set(results.map(r=>r.expectedDocumentId).filter(Boolean).map(String));const docsHit=new Set(results.filter(r=>r.matchedDocument&&r.expectedDocumentId).map(r=>String(r.expectedDocumentId)));const documentCoverage=docsExpected.size?Math.round((docsHit.size/docsExpected.size)*10000)/100:null;const byCat={};for(const r of results){const cat=r.groupName||'OUTROS';if(!byCat[cat])byCat[cat]={total:0,passed:0};byCat[cat].total+=1;if(r.verdict==='PASS')byCat[cat].passed+=1}const categoryCoverage={};for(const[k,v]of Object.entries(byCat)){categoryCoverage[k]={total:v.total,passed:v.passed,precision:Math.round((v.passed/v.total)*10000)/100}}const topErrors=results.filter(r=>r.verdict!=='PASS').slice(0,20).map(r=>({caseCode:r.caseCode,verdict:r.verdict,score:r.score,question:(r.question||'').slice(0,120)}));const docCounts={};for(const r of results){for(const s of r.sources||[]){const id=s.documentId||s.document_id;if(!id)continue;if(!docCounts[id])docCounts[id]={documentId:id,title:s.documentTitle||s.document_title,count:0};docCounts[id].count+=1}}const topDocuments=Object.values(docCounts).sort((a,b)=>b.count-a.count).slice(0,15);const overallScore=scores.length?Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*100)/100:0;return{precision,recall,documentCoverage,categoryCoverage,avgDurationMs:durations.length?Math.round((durations.reduce((a,b)=>a+b,0)/durations.length)*100)/100:null,minDurationMs:durations.length?Math.min(...durations):null,maxDurationMs:durations.length?Math.max(...durations):null,sourcesCorrectCount:results.filter(r=>r.sourcesCorrect).length,sourcesIncorrectCount:results.filter(r=>r.sourcesIncorrect).length,documentCorrectCount:results.filter(r=>r.matchedDocument).length,categoryCorrectCount:results.filter(r=>r.matchedCategory===true).length,subcategoryCorrectCount:results.filter(r=>r.matchedSubcategory===true).length,hallucinationCount:results.filter(r=>r.isHallucination).length,emptyAnswerCount:results.filter(r=>r.isEmptyAnswer).length,internalErrorCount:errors,passedCount:passed,failedCount:failed,totalCount:total,overallScore,topErrors,topDocuments,scoreFormula:'Per-case: answerQuality40 + sources30 + document20 + latency10. Run overall = average(case scores). Precision = passed/total.'}}`;

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

const carregarResultados = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar resultados',
    credentials: { postgres: PG_CRED },
    alwaysOutputData: true,
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        'SELECT r.id, r.run_id, r.case_id, r.case_code, r.question, r.answer, r.duration_ms, r.sources,\n' +
          '  r.chunk_refs, r.classification, r.matched_document, r.matched_category, r.matched_subcategory,\n' +
          '  r.required_words_hit, r.required_words_total, r.forbidden_words_hit, r.sources_correct,\n' +
          '  r.sources_incorrect, r.is_hallucination, r.is_empty_answer, r.is_internal_error, r.score,\n' +
          '  r.verdict, r.score_breakdown, r.created_at,\n' +
          '  c.expect_no_answer, c.group_name, c.expected_document_id\n' +
          'FROM ai_test_results r\n' +
          'JOIN ai_test_cases c ON c.id = r.case_id\n' +
          "WHERE r.run_id = '{{ $json.runId }}'::uuid\n" +
          'ORDER BY r.created_at ASC;'
      ),
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
        verdict: 'PASS',
        score: 80,
        expect_no_answer: false,
        group_name: 'GRUPO_A',
        expected_document_id: null,
      },
    },
  ],
});

const agregarMetricas = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Agregar métricas',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        AGG_FN +
        `\nconst rows = $input.all().map((i) => i.json).filter((j) => j && j.id);\n` +
        `const runId = $('Trigger').first().json.runId;\n` +
        `const mapped = rows.map((r) => ({\n` +
        `  verdict: r.verdict,\n` +
        `  score: r.score != null ? Number(r.score) : null,\n` +
        `  durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,\n` +
        `  expectNoAnswer: !!r.expect_no_answer,\n` +
        `  expectedDocumentId: r.expected_document_id,\n` +
        `  matchedDocument: r.matched_document,\n` +
        `  matchedCategory: r.matched_category,\n` +
        `  matchedSubcategory: r.matched_subcategory,\n` +
        `  groupName: r.group_name,\n` +
        `  sourcesCorrect: r.sources_correct,\n` +
        `  sourcesIncorrect: r.sources_incorrect,\n` +
        `  isHallucination: r.is_hallucination,\n` +
        `  isEmptyAnswer: r.is_empty_answer,\n` +
        `  caseCode: r.case_code,\n` +
        `  question: r.question,\n` +
        `  sources: Array.isArray(r.sources) ? r.sources : [],\n` +
        `}));\n` +
        `const agg = aggregateMetrics(mapped);\n` +
        `function esc(s) { return String(s ?? '').replace(/'/g, "''"); }\n` +
        `function j(v) { return esc(JSON.stringify(v ?? null)); }\n` +
        `const sql = "INSERT INTO ai_test_metrics (\\n" +\n` +
        `  "  run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms, max_duration_ms,\\n" +\n` +
        `  "  sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count, subcategory_correct_count,\\n" +\n` +
        `  "  hallucination_count, empty_answer_count, internal_error_count, passed_count, failed_count, total_count, overall_score,\\n" +\n` +
        `  "  top_errors, top_documents, score_formula\\n" +\n` +
        `  ") VALUES (\\n" +\n` +
        `  "  '" + esc(runId) + "'::uuid,\\n" +\n` +
        `  "  " + (agg.precision ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.recall ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.documentCoverage ?? 'NULL') + ",\\n" +\n` +
        `  "  '" + j(agg.categoryCoverage) + "'::jsonb,\\n" +\n` +
        `  "  " + (agg.avgDurationMs ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.minDurationMs ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.maxDurationMs ?? 'NULL') + ",\\n" +\n` +
        `  "  " + agg.sourcesCorrectCount + ", " + agg.sourcesIncorrectCount + ", " + agg.documentCorrectCount + ",\\n" +\n` +
        `  "  " + agg.categoryCorrectCount + ", " + agg.subcategoryCorrectCount + ",\\n" +\n` +
        `  "  " + agg.hallucinationCount + ", " + agg.emptyAnswerCount + ", " + agg.internalErrorCount + ",\\n" +\n` +
        `  "  " + agg.passedCount + ", " + agg.failedCount + ", " + agg.totalCount + ", " + (agg.overallScore ?? 'NULL') + ",\\n" +\n` +
        `  "  '" + j(agg.topErrors) + "'::jsonb, '" + j(agg.topDocuments) + "'::jsonb, '" + esc(agg.scoreFormula) + "'\\n" +\n` +
        `  ") ON CONFLICT (run_id) DO UPDATE SET\\n" +\n` +
        `  "  precision = EXCLUDED.precision, recall = EXCLUDED.recall, document_coverage = EXCLUDED.document_coverage,\\n" +\n` +
        `  "  category_coverage = EXCLUDED.category_coverage, avg_duration_ms = EXCLUDED.avg_duration_ms,\\n" +\n` +
        `  "  min_duration_ms = EXCLUDED.min_duration_ms, max_duration_ms = EXCLUDED.max_duration_ms,\\n" +\n` +
        `  "  sources_correct_count = EXCLUDED.sources_correct_count, sources_incorrect_count = EXCLUDED.sources_incorrect_count,\\n" +\n` +
        `  "  document_correct_count = EXCLUDED.document_correct_count, category_correct_count = EXCLUDED.category_correct_count,\\n" +\n` +
        `  "  subcategory_correct_count = EXCLUDED.subcategory_correct_count, hallucination_count = EXCLUDED.hallucination_count,\\n" +\n` +
        `  "  empty_answer_count = EXCLUDED.empty_answer_count, internal_error_count = EXCLUDED.internal_error_count,\\n" +\n` +
        `  "  passed_count = EXCLUDED.passed_count, failed_count = EXCLUDED.failed_count, total_count = EXCLUDED.total_count,\\n" +\n` +
        `  "  overall_score = EXCLUDED.overall_score, top_errors = EXCLUDED.top_errors, top_documents = EXCLUDED.top_documents,\\n" +\n` +
        `  "  score_formula = EXCLUDED.score_formula\\n" +\n` +
        `  "RETURNING id, run_id, precision, recall, document_coverage, category_coverage, avg_duration_ms, min_duration_ms,\\n" +\n` +
        `  "  max_duration_ms, sources_correct_count, sources_incorrect_count, document_correct_count, category_correct_count,\\n" +\n` +
        `  "  subcategory_correct_count, hallucination_count, empty_answer_count, internal_error_count, passed_count,\\n" +\n` +
        `  "  failed_count, total_count, overall_score, top_errors, top_documents, score_formula, created_at;";\n` +
        `const overallScoreSql = agg.overallScore != null ? String(agg.overallScore) : 'NULL';\n` +
        `const sqlUpdateRun = "UPDATE ai_test_runs SET total_cases = " + agg.totalCount + ", passed_count = " + agg.passedCount + ", failed_count = " + agg.failedCount + ", error_count = " + agg.internalErrorCount + ", overall_score = " + overallScoreSql + " WHERE id = '" + esc(runId) + "'::uuid RETURNING id;";\n` +
        `return [{ json: { sql, sqlUpdateRun, runId, agg } }];`,
    },
  },
  output: [{ json: { sql: 'INSERT INTO ai_test_metrics ...', sqlUpdateRun: 'UPDATE ai_test_runs ...', runId: '11111111-1111-1111-1111-111111111111', agg: { totalCount: 1 } } }],
});

const upsertMetricas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Upsert métricas',
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: expr('={{ $json.sql }}') },
  },
  output: [
    {
      json: {
        id: '44444444-4444-4444-4444-444444444444',
        run_id: '11111111-1111-1111-1111-111111111111',
        precision: 80,
        recall: 75,
        document_coverage: 90,
        category_coverage: {},
        avg_duration_ms: 5000,
        min_duration_ms: 1000,
        max_duration_ms: 9000,
        sources_correct_count: 1,
        sources_incorrect_count: 0,
        document_correct_count: 1,
        category_correct_count: 0,
        subcategory_correct_count: 0,
        hallucination_count: 0,
        empty_answer_count: 0,
        internal_error_count: 0,
        passed_count: 1,
        failed_count: 0,
        total_count: 1,
        overall_score: 80,
        top_errors: [],
        top_documents: [],
        score_formula: 'formula',
        created_at: '2026-08-03T00:00:00.000Z',
      },
    },
  ],
});

const atualizarContadores = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar contadores do run',
    credentials: { postgres: PG_CRED },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr("={{ $('Agregar métricas').first().json.sqlUpdateRun }}"),
    },
  },
  output: [{ json: { id: '11111111-1111-1111-1111-111111111111' } }],
});

const montarResposta = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar resposta',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const m = $('Upsert métricas').first().json;
const result = {
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
return [{ json: result }];`,
    },
  },
  output: [{ json: { id: '44444444-4444-4444-4444-444444444444', runId: '11111111-1111-1111-1111-111111111111', totalCount: 1, overallScore: 80 } }],
});

export default workflow('ia-calcular-metricas', 'IA - CALCULAR MÉTRICAS')
  .add(trig)
  .to(carregarResultados)
  .to(agregarMetricas)
  .to(upsertMetricas)
  .to(atualizarContadores)
  .to(montarResposta);
