#!/usr/bin/env node
/**
 * Etapa 21.2 — Fix run finalizer + CWM controlled fallback injection.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const PROJECT = 'WbvMM1wAedTR9qrk';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function publishVersion(workflowId, name, nodes, connections, description) {
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  return client.query('BEGIN')
    .then(() =>
      client.query(
        `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
         VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
        [versionId, workflowId, nodesJson, connJson, name, description],
      ),
    )
    .then(() =>
      client.query(
        `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
        [nodesJson, connJson, versionId, workflowId],
      ),
    )
    .then(() => client.query('COMMIT'))
    .then(() => versionId);
}

// ---------------------------------------------------------------------------
// 1) Official finalize code for Montar atualização do run
// ---------------------------------------------------------------------------
const FINALIZE_CODE = `const startedRow = $('Inserir run').first().json;
const metrics = $('Calcular métricas').first().json || {};
const rows = $('Carregar resultados finais').all().map((i) => i.json).filter((r) => r && r.id);
const fromRowsPassed = rows.filter((r) => String(r.verdict || '').toUpperCase() === 'PASS').length;
const fromRowsFailed = rows.filter((r) => String(r.verdict || '').toUpperCase() === 'FAIL').length;
const fromRowsError = rows.filter((r) => String(r.verdict || '').toUpperCase() === 'ERROR' || r.is_internal_error === true).length;
const fromRowsSkipped = rows.filter((r) => ['SKIPPED','BLOCKED'].includes(String(r.verdict || '').toUpperCase())).length;
// Source of truth: persisted results; metrics as fallback only
const passedCases = rows.length ? fromRowsPassed : Number(metrics.passedCount || 0);
const failedCases = rows.length ? fromRowsFailed : Number(metrics.failedCount || 0);
const errorCases = rows.length ? fromRowsError : Number(metrics.internalErrorCount || 0);
const skippedCases = rows.length ? fromRowsSkipped : Number(metrics.skippedCount || startedRow.skipped_count || 0);
const completedCases = rows.length ? rows.length : (passedCases + failedCases + errorCases + skippedCases);
const totalCases = Math.max(completedCases, Number(metrics.totalCount || startedRow.total_cases || 0));
const metricsGenerated = !!(metrics.id || metrics.runId || completedCases > 0);
const fatalError = metrics.fatalError === true || startedRow.fatal_error === true;
let status;
if (fatalError || (completedCases === 0 && !metricsGenerated)) status = 'FAILED';
else if (completedCases === 0) status = 'FAILED';
else if (failedCases === 0 && errorCases === 0 && skippedCases === 0) status = 'SUCCESS';
else if (passedCases > 0 || completedCases > 0) status = 'PARTIAL';
else status = 'FAILED';
const startedAt = new Date(startedRow.started_at);
const finishedAt = new Date();
const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
const consistencyCheck = {
  rule: 'etapa21.2-official',
  totalCases,
  completedCases,
  passedCases,
  failedCases,
  skippedCases,
  errorCases,
  metricsGenerated,
  fatalError,
  invariantOk: totalCases === passedCases + failedCases + skippedCases + errorCases || completedCases === passedCases + failedCases + skippedCases + errorCases,
};
function esc(s) { return String(s ?? '').replace(/'/g, "''"); }
const metaPatch = JSON.stringify({ consistencyCheck, metricsGenerated, finalizedAt: finishedAt.toISOString() }).replace(/'/g, "''");
const sql = "UPDATE ai_test_runs SET " +
  "status = '" + esc(status) + "', " +
  "finished_at = '" + finishedAt.toISOString() + "'::timestamp, " +
  "duration_ms = " + durationMs + ", " +
  "total_cases = " + totalCases + ", " +
  "passed_count = " + passedCases + ", " +
  "failed_count = " + failedCases + ", " +
  "error_count = " + errorCases + ", " +
  "skipped_count = " + skippedCases + ", " +
  "metadata = COALESCE(metadata,'{}'::jsonb) || '" + metaPatch + "'::jsonb " +
  "WHERE id = '" + esc(startedRow.id) + "'::uuid " +
  "RETURNING id, started_at, finished_at, duration_ms, status, triggered_by, trigger_mode, total_cases, passed_count, failed_count, error_count, skipped_count, overall_score, prompt_version, model_name, ocr_engine_version, tabular_engine_version, report, metadata, created_at, prompt_version_id, context_config_version_id, context_mode_override_used;";
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
    promptVersionId: r.prompt_version_id || null,
    modelName: r.model_name || null,
    contextFallbackUsed: r.context_fallback_used === true,
    contextMode: r.context_mode || null,
    estimatedContextTokens: r.estimated_context_tokens != null ? Number(r.estimated_context_tokens) : null,
    contextUtilizationRate: r.context_utilization_rate != null ? Number(r.context_utilization_rate) : null,
    overflowDetected: r.overflow_detected === true,
    insufficientContext: r.insufficient_context === true,
    conflictDetected: r.conflict_detected === true,
    conflictType: r.conflict_type || null,
    createdAt: r.created_at,
  };
}
const results = rows.map(camelResult);
return [{ json: { sql, results, metrics, status, consistencyCheck, totalCases, passedCases, failedCases, errorCases, skippedCases } }];
`;

{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const n = nodes.find((x) => x.name === 'Montar atualização do run');
  n.parameters.jsCode = FINALIZE_CODE;
  const versionId = await publishVersion(
    '12t0Ol6zWQJgAKPC',
    rows[0].name,
    nodes,
    connections,
    'Official run status finalizer (results as source of truth)',
  );
  console.log('DATASET finalizer', versionId);
}

// Also update CALCULAR MÉTRICAS sqlUpdateRun to set status correctly (secondary)
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const n = nodes.find((x) => x.name === 'Agregar métricas');
  let code = n.parameters.jsCode;
  if (!code.includes('statusSql')) {
    code = code.replace(
      /const sqlUpdateRun = "UPDATE ai_test_runs SET total_cases/,
      `const finalizeStatus = (agg.totalCount === 0) ? 'FAILED' : (agg.failedCount === 0 && agg.internalErrorCount === 0 ? 'SUCCESS' : (agg.passedCount > 0 ? 'PARTIAL' : 'FAILED'));
const sqlUpdateRun = "UPDATE ai_test_runs SET status = '" + finalizeStatus + "', total_cases`,
    );
    n.parameters.jsCode = code;
    const versionId = await publishVersion(
      '1uITQcJ5jSNXErOM',
      rows[0].name,
      nodes,
      connections,
      'Set provisional status with counts',
    );
    console.log('CALC MÉTRICAS status', versionId);
  } else {
    console.log('CALC MÉTRICAS already has statusSql');
  }
}

// ---------------------------------------------------------------------------
// 2) CWM forceContextFailureForTest (lab-only, sanitized reason)
// ---------------------------------------------------------------------------
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='e95a92295d7c4deb'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const n = nodes.find((x) => x.name === 'Montar janela');
  let code = n.parameters.jsCode;

  // Inject controlled failure after config load, before selection
  if (!code.includes('forceContextFailureForTest')) {
    const marker = 'const mode=String(cfgNode.mode||cfg.mode||\'LEGACY\').toUpperCase();';
    if (!code.includes(marker)) throw new Error('CWM marker missing');
    const inject = `${marker}
const forceContextFailureForTest = inp.forceContextFailureForTest === true || inp.forceContextFailureForTest === 'true';
if (forceContextFailureForTest) {
  const err = new Error('TEST_INJECTED_CONTEXT_FAILURE');
  err.code = 'TEST_INJECTED_CONTEXT_FAILURE';
  throw err;
}
`;
    code = code.replace(marker, inject);
  }

  // Sanitize fallbackReason
  code = code.replace(
    /fallbackReason:String\(err&&err\.message\|\|err\|\|'context_manager_error'\)\.slice\(0,200\)/,
    `fallbackReason:(String(err&&err.code||err&&err.message||'')==='TEST_INJECTED_CONTEXT_FAILURE'?'TEST_INJECTED_CONTEXT_FAILURE':'CONTEXT_BUILD_ERROR')`,
  );

  n.parameters.jsCode = code;

  // Ensure trigger/normalize passes forceContextFailureForTest through if present
  const prep = nodes.find((x) => /normaliz|prepar|entrada|trigger/i.test(x.name) && x.parameters?.jsCode);
  if (prep && prep.parameters.jsCode && !prep.parameters.jsCode.includes('forceContextFailureForTest')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      /return\s*\[\s*\{\s*json\s*:\s*\{/,
      `return [{ json: { forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'), `,
    );
  }

  const versionId = await publishVersion(
    'e95a92295d7c4deb',
    rows[0].name,
    nodes,
    connections,
    'Controlled lab-only context failure injection',
  );
  console.log('CWM fallback inject', versionId);
  writeFileSync(new URL('./_c212-cwm-montar.js', import.meta.url), code);
}

// ---------------------------------------------------------------------------
// 3) Consulta IA: pass forceContextFailureForTest only when lab override allowed
// ---------------------------------------------------------------------------
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const cwm = nodes.find((x) => x.name === 'IA - GERENCIAR JANELA DE CONTEXTO');
  if (!cwm) throw new Error('CWM call node missing in Consulta');
  const inputs = cwm.parameters?.workflowInputs?.value || {};
  if (!inputs.forceContextFailureForTest) {
    inputs.forceContextFailureForTest = `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.forceContextFailureForTest===true||b.forceContextFailureForTest==='true'||q.forceContextFailureForTest===true||q.forceContextFailureForTest==='true';
  if(!flag) return false;
  // Only when context override lab gate is also allowed
  let allowed=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const user=auth.user||{};
    const perms=[...(Array.isArray(auth.permissions)?auth.permissions:[]),...(Array.isArray(user.permissions)?user.permissions:[])].map(p=>String(p).toLowerCase());
    allowed=auth.isMaster===true||user.isMaster===true||perms.includes('editar_configuracoes');
  } catch(_) {}
  const overrideFlag=b.contextConfigOverrideAllowed===true||b.contextConfigOverrideAllowed==='true';
  return (allowed && overrideFlag) ? true : false;
})() }}`;
    cwm.parameters.workflowInputs.value = inputs;
  }
  const versionId = await publishVersion(
    '8EXk5RkFW5cxnenL',
    rows[0].name,
    nodes,
    connections,
    'Gate forceContextFailureForTest to lab override',
  );
  console.log('Consulta force gate', versionId);
}

// ---------------------------------------------------------------------------
// 4) Repair historical inconsistent runs (safe inference)
// ---------------------------------------------------------------------------
const repair = await client.query(`
  WITH counts AS (
    SELECT run_id,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE verdict='PASS')::int AS passed,
      COUNT(*) FILTER (WHERE verdict='FAIL')::int AS failed,
      COUNT(*) FILTER (WHERE verdict='ERROR')::int AS errors,
      COUNT(*) FILTER (WHERE verdict IN ('SKIPPED','BLOCKED'))::int AS skipped
    FROM ai_test_results
    GROUP BY run_id
  ),
  decided AS (
    SELECT r.id,
      c.total, c.passed, c.failed, c.errors, c.skipped,
      CASE
        WHEN c.total = 0 THEN r.status
        WHEN c.failed = 0 AND c.errors = 0 AND c.skipped = 0 THEN 'SUCCESS'
        ELSE 'PARTIAL'
      END AS new_status
    FROM ai_test_runs r
    JOIN counts c ON c.run_id = r.id
    WHERE r.status = 'FAILED'
      AND c.total > 0
      AND COALESCE(r.error_count,0) = 0
  )
  UPDATE ai_test_runs r
  SET status = d.new_status,
      total_cases = d.total,
      passed_count = d.passed,
      failed_count = d.failed,
      error_count = d.errors,
      skipped_count = d.skipped,
      metadata = COALESCE(r.metadata,'{}'::jsonb) || jsonb_build_object(
        'historicalStatusRepair', jsonb_build_object(
          'at', NOW(),
          'from', 'FAILED',
          'to', d.new_status,
          'rule', 'etapa21.2-safe-repair'
        )
      )
  FROM decided d
  WHERE r.id = d.id
  RETURNING r.id, r.status, r.total_cases, r.passed_count, r.failed_count
`);
console.log('repaired runs', repair.rows.length);
writeFileSync(
  new URL('./_c212-repaired-runs.json', import.meta.url),
  JSON.stringify(repair.rows, null, 2),
);

await client.end();
console.log('core patch done');
