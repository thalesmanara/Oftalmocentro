#!/usr/bin/env node
/**
 * Fix dataset insert columns + complete metrics/health/backup patches
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function save(id, nodes, connections, name, desc) {
  const versionId = randomUUID();
  const connJson =
    typeof connections === 'string' ? connections : JSON.stringify(connections);
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa25',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), connJson, name, desc],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), connJson, versionId, id],
  );
  await c.query('COMMIT');
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [id]);
  console.log('saved', id, versionId);
}

// Fix Avaliar insert — columns list
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  let code = n.parameters.jsCode;
  writeFileSync(new URL('./_e25-avaliar-db-now.js', import.meta.url), code);

  const colIdx = code.indexOf('conflict_type');
  console.log('col context', JSON.stringify(code.slice(colIdx, colIdx + 80)));

  if (!code.includes('response_policy_strategy, response_policy_reason_codes')) {
    // Replace conflict_type closing in COLUMN list only (first occurrence in INSERT cols)
    const insertColsStart = code.indexOf('INSERT INTO ai_test_results');
    const valuesStart = code.indexOf(') VALUES (');
    const cols = code.slice(insertColsStart, valuesStart);
    if (!cols.includes('response_policy_strategy')) {
      const fixedCols = cols.replace(
        'source_count, conflict_type',
        'source_count, conflict_type,\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms',
      );
      if (fixedCols === cols) throw new Error('col replace failed');
      code = code.slice(0, insertColsStart) + fixedCols + code.slice(valuesStart);
    }
  }

  // Ensure values include policy (may already)
  if (!code.includes('policyMeta.strategy')) {
    throw new Error('policy values missing — unexpected');
  }

  // Fix broken ",\\n" that should match existing "\n" style — verify SQL fragments
  // Existing style uses "\n" (backslash-n in source). Our patch used ",\\n" in template → ",\n" in code. OK.

  n.parameters.jsCode = code;
  writeFileSync(new URL('./_e25-avaliar-fixed.js', import.meta.url), code);
  console.log('has cols now', code.includes('response_policy_strategy, response_policy_reason_codes'));
  await save('KdpEmEGHNlPICOa4', nodes, rows[0].connections, rows[0].name, 'e25 fix dataset cols');
}

// Metrics
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Agregar métricas');
  let code = n.parameters.jsCode;

  if (!code.includes('response_policy_warning_rate')) {
    // mapped
    if (!code.includes('responsePolicyStrategy')) {
      code = code.replace(
        'rankedDocumentIds: Array.isArray(r.retrieval_ranked_document_ids) ? r.retrieval_ranked_document_ids : [],\n}));',
        `rankedDocumentIds: Array.isArray(r.retrieval_ranked_document_ids) ? r.retrieval_ranked_document_ids : [],
  responsePolicyStrategy: r.response_policy_strategy || null,
  responsePolicyWarning: !!r.response_policy_warning,
  responsePolicyAbstained: !!r.response_policy_abstained,
  responsePolicyDeclined: !!r.response_policy_declined,
  responsePolicyClarification: !!r.response_policy_clarification_required,
  responsePolicyLatencyMs: r.response_policy_latency_ms != null ? Number(r.response_policy_latency_ms) : null,
  responsePolicyReasonCodes: Array.isArray(r.response_policy_reason_codes) ? r.response_policy_reason_codes : [],
}));`,
      );
    }

    if (!code.includes('warnRate=')) {
      code = code.replace(
        'return{precision,recall,documentCoverage,',
        `const totalP=results.length||1;
const warnRate=results.filter(r=>r.responsePolicyWarning||r.responsePolicyStrategy==='ANSWER_WITH_WARNING').length/totalP;
const limRate=results.filter(r=>r.responsePolicyStrategy==='ANSWER_WITH_LIMITATION').length/totalP;
const clarRate=results.filter(r=>r.responsePolicyClarification||r.responsePolicyStrategy==='REQUEST_CLARIFICATION').length/totalP;
const absRate=results.filter(r=>r.responsePolicyAbstained||r.responsePolicyStrategy==='ABSTAIN').length/totalP;
const decRate=results.filter(r=>r.responsePolicyDeclined||r.responsePolicyStrategy==='DECLINE').length/totalP;
const conflictExplRate=results.filter(r=>r.responsePolicyStrategy==='ANSWER_WITH_WARNING').length/totalP;
const lowConfRate=results.filter(r=>(r.responsePolicyReasonCodes||[]).some(x=>/LOW|POOR|COVERAGE/.test(String(x)))||r.responsePolicyStrategy==='ANSWER_WITH_LIMITATION').length/totalP;
const polLats=results.map(r=>Number(r.responsePolicyLatencyMs)).filter(Number.isFinite);
const avgPolLat=polLats.length?Math.round(polLats.reduce((a,b)=>a+b,0)/polLats.length):null;
return{precision,recall,documentCoverage,`,
      );
      code = code.replace(
        'fallbackCount,categoryCoverage,',
        'fallbackCount,responsePolicyWarningRate:Math.round(warnRate*10000)/10000,responsePolicyLimitationRate:Math.round(limRate*10000)/10000,responsePolicyClarificationRate:Math.round(clarRate*10000)/10000,responsePolicyAbstentionRate:Math.round(absRate*10000)/10000,responsePolicyDeclineRate:Math.round(decRate*10000)/10000,responsePolicyConflictExplanationRate:Math.round(conflictExplRate*10000)/10000,responsePolicyLowConfidenceHandlingRate:Math.round(lowConfRate*10000)/10000,avgResponsePolicyLatencyMs:avgPolLat,categoryCoverage,',
      );
    }

    // INSERT column list — exact needle uses literal \n (backslash-n) inside the JS string
    const colNeedle = 'source_precision, source_recall\\n" +';
    const colIdx = code.indexOf(colNeedle);
    console.log('colIdx', colIdx);
    if (colIdx < 0) {
      console.log('try find', code.includes('source_precision, source_recall'));
      throw new Error('metrics col needle missing');
    }
    code =
      code.slice(0, colIdx) +
      'source_precision, source_recall,\\n" +\n"  response_policy_warning_rate, response_policy_limitation_rate, response_policy_clarification_rate,\\n" +\n"  response_policy_abstention_rate, response_policy_decline_rate, response_policy_conflict_explanation_rate,\\n" +\n"  response_policy_low_confidence_handling_rate, avg_response_policy_latency_ms\\n" +' +
      code.slice(colIdx + colNeedle.length);

    // values
    const valNeedle = `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\\n" +`;
    const valIdx = code.indexOf(valNeedle);
    console.log('valIdx', valIdx);
    if (valIdx < 0) throw new Error('metrics values needle missing');
    code =
      code.slice(0, valIdx) +
      `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + ",\\n" +\n  "  " + (agg.responsePolicyWarningRate ?? 'NULL') + ", " + (agg.responsePolicyLimitationRate ?? 'NULL') + ", " + (agg.responsePolicyClarificationRate ?? 'NULL') + ",\\n" +\n  "  " + (agg.responsePolicyAbstentionRate ?? 'NULL') + ", " + (agg.responsePolicyDeclineRate ?? 'NULL') + ", " + (agg.responsePolicyConflictExplanationRate ?? 'NULL') + ",\\n" +\n  "  " + (agg.responsePolicyLowConfidenceHandlingRate ?? 'NULL') + ", " + (agg.avgResponsePolicyLatencyMs ?? 'NULL') + "\\n" +` +
      code.slice(valIdx + valNeedle.length);

    // ON CONFLICT
    const updNeedle =
      'source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall\\n" +';
    const updIdx = code.indexOf(updNeedle);
    console.log('updIdx', updIdx);
    if (updIdx < 0) throw new Error('metrics update needle missing');
    code =
      code.slice(0, updIdx) +
      'source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall,\\n" +\n"  response_policy_warning_rate = EXCLUDED.response_policy_warning_rate,\\n" +\n"  response_policy_limitation_rate = EXCLUDED.response_policy_limitation_rate,\\n" +\n"  response_policy_clarification_rate = EXCLUDED.response_policy_clarification_rate,\\n" +\n"  response_policy_abstention_rate = EXCLUDED.response_policy_abstention_rate,\\n" +\n"  response_policy_decline_rate = EXCLUDED.response_policy_decline_rate,\\n" +\n"  response_policy_conflict_explanation_rate = EXCLUDED.response_policy_conflict_explanation_rate,\\n" +\n"  response_policy_low_confidence_handling_rate = EXCLUDED.response_policy_low_confidence_handling_rate,\\n" +\n"  avg_response_policy_latency_ms = EXCLUDED.avg_response_policy_latency_ms\\n" +' +
      code.slice(updIdx + updNeedle.length);

    n.parameters.jsCode = code;
    writeFileSync(new URL('./_e25-metrics-fixed.js', import.meta.url), code);
    console.log(
      'metrics ok',
      code.includes('response_policy_warning_rate'),
      code.includes('agg.responsePolicyWarningRate'),
      code.includes('EXCLUDED.response_policy_warning_rate'),
    );
    await save('1uITQcJ5jSNXErOM', nodes, rows[0].connections, rows[0].name, 'e25 metrics policy');
  } else console.log('metrics already ok');
}

// Health
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const probe = nodes.find((n) => n.name === 'Probe database');
  let query = String(probe.parameters.query);
  if (!query.includes('rq_warnings_7d')) {
    if (!query.includes('rq_policy_enabled')) {
      console.log('WARN: rq_policy_enabled missing from probe');
    } else {
      query = query.replace(
        'AS rq_policy_enabled',
        `AS rq_policy_enabled,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(response_policy_warning,false) IS TRUE) AS rq_warnings_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_strategy = 'ANSWER_WITH_LIMITATION') AS rq_limitations_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(response_policy_clarification_required,false) IS TRUE) AS rq_clarifications_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(response_policy_abstained,false) IS TRUE) AS rq_abstentions_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND COALESCE(response_policy_declined,false) IS TRUE) AS rq_declines_7d,
    (SELECT COUNT(*)::int FROM audit_logs WHERE occurred_at >= NOW() - INTERVAL '7 days' AND action LIKE 'AI_RESPONSE_POLICY_%' AND COALESCE(success,true) IS FALSE) AS rq_policy_failures_7d,
    (SELECT ROUND(AVG(response_policy_latency_ms)::numeric, 2) FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_latency_ms IS NOT NULL) AS rq_avg_policy_latency_ms,
    (SELECT COALESCE(jsonb_object_agg(strategy, cnt), '{}'::jsonb) FROM (
       SELECT COALESCE(response_policy_strategy, 'UNKNOWN') AS strategy, COUNT(*)::int AS cnt
       FROM ai_test_results
       WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_strategy IS NOT NULL
       GROUP BY 1
     ) s) AS rq_strategy_dist_7d`,
      );
      if (!query.includes('rq_stats.rq_warnings_7d')) {
        query = query.replace(
          'rq_stats.rq_policy_enabled,',
          `rq_stats.rq_policy_enabled,
  rq_stats.rq_warnings_7d,
  rq_stats.rq_limitations_7d,
  rq_stats.rq_clarifications_7d,
  rq_stats.rq_abstentions_7d,
  rq_stats.rq_declines_7d,
  rq_stats.rq_policy_failures_7d,
  rq_stats.rq_avg_policy_latency_ms,
  rq_stats.rq_strategy_dist_7d,`,
        );
      }
      probe.parameters.query = query;
    }
  }

  const prep = nodes.find((n) => n.name === 'Prepare checks');
  if (prep && !prep.parameters.jsCode.includes('warnings7d:')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      "policyEnabled: String(dbItem.rq_policy_enabled || 'false') === 'true',",
      `policyEnabled: String(dbItem.rq_policy_enabled || 'false') === 'true',
      warnings7d: dbItem.rq_warnings_7d != null ? Number(dbItem.rq_warnings_7d) : 0,
      limitations7d: dbItem.rq_limitations_7d != null ? Number(dbItem.rq_limitations_7d) : 0,
      clarifications7d: dbItem.rq_clarifications_7d != null ? Number(dbItem.rq_clarifications_7d) : 0,
      abstentions7d: dbItem.rq_abstentions_7d != null ? Number(dbItem.rq_abstentions_7d) : 0,
      declines7d: dbItem.rq_declines_7d != null ? Number(dbItem.rq_declines_7d) : 0,
      policyFailures7d: dbItem.rq_policy_failures_7d != null ? Number(dbItem.rq_policy_failures_7d) : 0,
      averagePolicyLatencyMs: dbItem.rq_avg_policy_latency_ms != null ? Number(dbItem.rq_avg_policy_latency_ms) : null,
      strategyDistribution7d: dbItem.rq_strategy_dist_7d || null,`,
    );
  }

  const agg = nodes.find((n) => n.name === 'Aggregate health');
  if (agg) {
    let ac = agg.parameters.jsCode;
    const reps = [
      ['warnings7d: null,', 'warnings7d: e.warnings7d != null ? Number(e.warnings7d) : 0,'],
      ['limitations7d: null,', 'limitations7d: e.limitations7d != null ? Number(e.limitations7d) : 0,'],
      ['clarifications7d: null,', 'clarifications7d: e.clarifications7d != null ? Number(e.clarifications7d) : 0,'],
      ['abstentions7d: null,', 'abstentions7d: e.abstentions7d != null ? Number(e.abstentions7d) : 0,'],
      ['declines7d: null,', 'declines7d: e.declines7d != null ? Number(e.declines7d) : 0,'],
      ['policyFailures7d: null,', 'policyFailures7d: e.policyFailures7d != null ? Number(e.policyFailures7d) : 0,'],
      [
        'averagePolicyLatencyMs: null,',
        'averagePolicyLatencyMs: e.averagePolicyLatencyMs != null ? Number(e.averagePolicyLatencyMs) : null,',
      ],
      ['strategyDistribution7d: null,', 'strategyDistribution7d: e.strategyDistribution7d || null,'],
    ];
    for (const [a, b] of reps) ac = ac.split(a).join(b);
    agg.parameters.jsCode = ac;
  }

  await save('qAyYc9DrHIqe4L9i', nodes, rows[0].connections, rows[0].name, 'e25 health 7d');
}

// Backup
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='A16PhhWFr0Za9X3B'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Exportar tabelas app');
  let q = n.parameters.query;
  if (!q.includes('ai_response_quality_configs')) {
    if (!q.includes('ai_retrieval_config_versions')) throw new Error('backup needle missing');
    q = q.replace(
      "'ai_retrieval_config_versions', (SELECT COALESCE(json_agg(row_to_json(arv)), '[]'::json) FROM ai_retrieval_config_versions arv),",
      `'ai_retrieval_config_versions', (SELECT COALESCE(json_agg(row_to_json(arv)), '[]'::json) FROM ai_retrieval_config_versions arv),
    'ai_response_quality_configs', (SELECT COALESCE(json_agg(row_to_json(rqc)), '[]'::json) FROM ai_response_quality_configs rqc),
    'ai_response_quality_config_versions', (SELECT COALESCE(json_agg(row_to_json(rqv)), '[]'::json) FROM ai_response_quality_config_versions rqv),`,
    );
    n.parameters.query = q;
    await save('A16PhhWFr0Za9X3B', nodes, rows[0].connections, rows[0].name, 'e25 backup RQ');
  } else console.log('backup ok');
}

await c.end();
console.log('fix+rest done');
