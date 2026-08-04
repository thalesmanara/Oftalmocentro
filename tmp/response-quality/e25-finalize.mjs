#!/usr/bin/env node
/**
 * Etapa 25 finalize — audit, dataset, metrics, health, backup
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function save(id, nodes, connections, name, desc = 'e25 finalize') {
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
  console.log('saved', id, name, versionId);
}

// ========== 1) Audit ==========
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const audit = nodes.find((n) => n.name === 'Registrar auditoria sucesso');
  const v = audit.parameters.workflowInputs.value;
  const already = String(v.action || '').includes('AI_RESPONSE_POLICY');
  if (!already) {
    v.action = `={{ (() => {
  try {
    const pol = $('Aplicar política resposta').first().json || {};
    if (pol.auditAction) return String(pol.auditAction);
  } catch (_) {}
  const data = ($json.response && $json.response.data) || {};
  const p = data.policyMeta || {};
  if (p.declined) return 'AI_RESPONSE_POLICY_DECLINE';
  if (p.abstained) return 'AI_RESPONSE_POLICY_ABSTAIN';
  if (p.clarificationRequired) return 'AI_RESPONSE_POLICY_CLARIFICATION';
  if (p.warningApplied || p.strategy === 'ANSWER_WITH_WARNING') return 'AI_RESPONSE_POLICY_WARNING';
  if (p.strategy === 'ANSWER_WITH_LIMITATION') return 'AI_RESPONSE_POLICY_LIMITATION';
  if (p.strategy) return 'AI_RESPONSE_POLICY_APPLIED';
  return 'AI_QUERY';
})() }}`;
    v.metadata = `={{ (() => {
  const resp = $json.response || {};
  const data = resp.data || {};
  const mr = (() => { try { return $('Montar resposta').first().json || {}; } catch (_) { return {}; } })();
  const pm = mr.promptMeta || {};
  const policy = data.policyMeta || (() => { try { return $('Aplicar política resposta').first().json.policyMeta || {}; } catch (_) { return {}; } })();
  const q = data.question || mr.data?.question || '';
  const a = data.answer || '';
  const sources = data.sources || [];
  const cls = data.classification || {};
  return {
    questionLength: String(q).length,
    answerLength: String(a).length,
    sourcesCount: sources.length,
    documentIds: sources.map(s => s.documentId).filter(Boolean),
    categoryId: cls.categoryId || null,
    categoryName: cls.categoryName || null,
    subcategoryId: cls.subcategoryId || null,
    subcategoryName: cls.subcategoryName || null,
    promptVersionId: pm.promptVersionId || null,
    promptCode: pm.promptCode || null,
    promptVersionNumber: pm.versionNumber != null ? pm.versionNumber : null,
    promptContentHash: pm.contentHash || null,
    promptModelName: pm.modelName || null,
    responsePolicyStrategy: policy.strategy || null,
    responsePolicyReasonCodes: Array.isArray(policy.reasonCodes) ? policy.reasonCodes : [],
    responsePolicyWarning: !!policy.warningApplied,
    responsePolicyAnswerModified: !!policy.answerModified,
    responsePolicyAbstained: !!policy.abstained,
    responsePolicyDeclined: !!policy.declined,
    responsePolicyClarificationRequired: !!policy.clarificationRequired,
    responsePolicyConfigVersion: policy.configVersion || null,
    responsePolicyLatencyMs: policy.durationMs != null ? Number(policy.durationMs) : null,
  };
})() }}`;
    await save('8EXk5RkFW5cxnenL', nodes, rows[0].connections, rows[0].name, 'e25 audit policy');
  } else {
    console.log('audit already patched');
  }
}

// ========== 2) Dataset Avaliar insert ==========
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  let code = n.parameters.jsCode;
  if (!code.includes('response_policy_strategy')) {
    writeFileSync(new URL('./_e25-before-avaliar.js', import.meta.url), code);

    if (!code.includes('const policyMeta')) {
      code = code.replace(
        "const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};",
        "const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};\nconst policyMeta = data.policyMeta && typeof data.policyMeta === 'object' ? data.policyMeta : {};",
      );
    }

    code = code.replace(
      'source_count, conflict_type\n" +',
      'source_count, conflict_type,\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\n" +',
    );

    // Show exact bytes around overflowDetected value
    const i = code.indexOf('(overflowDetected ?');
    console.log('value snippet JSON:', JSON.stringify(code.slice(i, i + 320)));

    // Replace the last value line (overflow/empty/source/conflict) to append policy fields
    const valRe =
      /\(overflowDetected \? 'true' : 'false'\) \+ ", " \+ \(emptyContext \? 'true' : 'false'\) \+ ", " \+ \(sourceCount == null \? 'NULL' : String\(sourceCount\)\) \+ ", " \+ \(conflictType \? \("'" \+ esc\(conflictType\) \+ "'"\) : 'NULL'\) \+ "(\\n)" \+/;

    if (!valRe.test(code)) {
      throw new Error('value regex failed: ' + JSON.stringify(code.slice(i, i + 320)));
    }
    code = code.replace(
      valRe,
      `(overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + ",\\n" +\n` +
        `  "  " + (policyMeta.strategy ? ("'" + esc(policyMeta.strategy) + "'") : 'NULL') + ",\\n" +\n` +
        `  "  '" + j(Array.isArray(policyMeta.reasonCodes) ? policyMeta.reasonCodes : []) + "'::jsonb,\\n" +\n` +
        `  "  " + (policyMeta.warningApplied ? 'true' : 'false') + ", " + (policyMeta.answerModified ? 'true' : 'false') + ",\\n" +\n` +
        `  "  " + (policyMeta.abstained ? 'true' : 'false') + ", " + (policyMeta.declined ? 'true' : 'false') + ", " + (policyMeta.clarificationRequired ? 'true' : 'false') + ",\\n" +\n` +
        `  "  " + (policyMeta.durationMs == null ? 'NULL' : String(Math.round(Number(policyMeta.durationMs) || 0))) + "\\n" +`,
    );

    // Fix: the replace above used \\n in template which becomes \n in output string (one backslash + n)
    // But original code uses actual newline char inside quotes. Check result:
    const j = code.indexOf('policyMeta.strategy');
    console.log('after patch snippet:', JSON.stringify(code.slice(j - 40, j + 200)));

    n.parameters.jsCode = code;
    writeFileSync(new URL('./_e25-after-avaliar.js', import.meta.url), code);
    await save('KdpEmEGHNlPICOa4', nodes, rows[0].connections, rows[0].name, 'e25 dataset policy');
  } else {
    console.log('dataset insert already patched');
  }
}

// ========== 3) Metrics aggregator ==========
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Agregar métricas');
  let code = n.parameters.jsCode;
  if (!code.includes('response_policy_warning_rate')) {
    // extend mapped rows
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

    code = code.replace(
      "return{precision,recall,",
      `const totalP=results.length||1;
const warnRate=results.filter(r=>r.responsePolicyWarning||r.responsePolicyStrategy==='ANSWER_WITH_WARNING').length/totalP;
const limRate=results.filter(r=>r.responsePolicyStrategy==='ANSWER_WITH_LIMITATION').length/totalP;
const clarRate=results.filter(r=>r.responsePolicyClarification||r.responsePolicyStrategy==='REQUEST_CLARIFICATION').length/totalP;
const absRate=results.filter(r=>r.responsePolicyAbstained||r.responsePolicyStrategy==='ABSTAIN').length/totalP;
const decRate=results.filter(r=>r.responsePolicyDeclined||r.responsePolicyStrategy==='DECLINE').length/totalP;
const conflictExplRate=results.filter(r=>r.responsePolicyStrategy==='ANSWER_WITH_WARNING').length/totalP;
const lowConfRate=results.filter(r=>(r.responsePolicyReasonCodes||[]).some(x=>String(x).includes('LOW')||String(x).includes('POOR')||String(x).includes('COVERAGE'))||r.responsePolicyStrategy==='ANSWER_WITH_LIMITATION').length/totalP;
const polLats=results.map(r=>Number(r.responsePolicyLatencyMs)).filter(Number.isFinite);
const avgPolLat=polLats.length?Math.round(polLats.reduce((a,b)=>a+b,0)/polLats.length):null;
return{precision,recall,`,
    );

    code = code.replace(
      "scoreFormula:'Per-case:",
      `responsePolicyWarningRate:Math.round(warnRate*10000)/10000,responsePolicyLimitationRate:Math.round(limRate*10000)/10000,responsePolicyClarificationRate:Math.round(clarRate*10000)/10000,responsePolicyAbstentionRate:Math.round(absRate*10000)/10000,responsePolicyDeclineRate:Math.round(decRate*10000)/10000,responsePolicyConflictExplanationRate:Math.round(conflictExplRate*10000)/10000,responsePolicyLowConfidenceHandlingRate:Math.round(lowConfRate*10000)/10000,avgResponsePolicyLatencyMs:avgPolLat,scoreFormula:'Per-case:`,
    );

    // SQL columns
    code = code.replace(
      'source_precision, source_recall\n" +',
      'source_precision, source_recall,\n" +\n"  response_policy_warning_rate, response_policy_limitation_rate, response_policy_clarification_rate,\n" +\n"  response_policy_abstention_rate, response_policy_decline_rate, response_policy_conflict_explanation_rate,\n" +\n"  response_policy_low_confidence_handling_rate, avg_response_policy_latency_ms\n" +',
    );
    code = code.replace(
      '  "  " + (agg.sourcePrecision ?? \'NULL\') + ", " + (agg.sourceRecall ?? \'NULL\') + "\\n" +',
      `  "  " + (agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.responsePolicyWarningRate ?? 'NULL') + ", " + (agg.responsePolicyLimitationRate ?? 'NULL') + ", " + (agg.responsePolicyClarificationRate ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.responsePolicyAbstentionRate ?? 'NULL') + ", " + (agg.responsePolicyDeclineRate ?? 'NULL') + ", " + (agg.responsePolicyConflictExplanationRate ?? 'NULL') + ",\\n" +\n` +
        `  "  " + (agg.responsePolicyLowConfidenceHandlingRate ?? 'NULL') + ", " + (agg.avgResponsePolicyLatencyMs ?? 'NULL') + "\\n" +`,
    );
    // try with real newline in string
    if (!code.includes('response_policy_warning_rate, response_policy_limitation_rate')) {
      throw new Error('metrics col patch failed');
    }
    if (!code.includes('responsePolicyWarningRate')) {
      throw new Error('metrics agg fields failed');
    }
    // fix values if still old
    if (!code.includes('agg.responsePolicyWarningRate')) {
      const i = code.indexOf('agg.sourcePrecision');
      console.log('metrics values snippet', JSON.stringify(code.slice(i, i + 200)));
      code = code.replace(
        `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\\n" +
  ") ON CONFLICT`,
        `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + ",\\n" +
  "  " + (agg.responsePolicyWarningRate ?? 'NULL') + ", " + (agg.responsePolicyLimitationRate ?? 'NULL') + ", " + (agg.responsePolicyClarificationRate ?? 'NULL') + ",\\n" +
  "  " + (agg.responsePolicyAbstentionRate ?? 'NULL') + ", " + (agg.responsePolicyDeclineRate ?? 'NULL') + ", " + (agg.responsePolicyConflictExplanationRate ?? 'NULL') + ",\\n" +
  "  " + (agg.responsePolicyLowConfidenceHandlingRate ?? 'NULL') + ", " + (agg.avgResponsePolicyLatencyMs ?? 'NULL') + "\\n" +
  ") ON CONFLICT`,
      );
      code = code.replace(
        `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\n" +
  ") ON CONFLICT`,
        `(agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + ",\n" +
  "  " + (agg.responsePolicyWarningRate ?? 'NULL') + ", " + (agg.responsePolicyLimitationRate ?? 'NULL') + ", " + (agg.responsePolicyClarificationRate ?? 'NULL') + ",\n" +
  "  " + (agg.responsePolicyAbstentionRate ?? 'NULL') + ", " + (agg.responsePolicyDeclineRate ?? 'NULL') + ", " + (agg.responsePolicyConflictExplanationRate ?? 'NULL') + ",\n" +
  "  " + (agg.responsePolicyLowConfidenceHandlingRate ?? 'NULL') + ", " + (agg.avgResponsePolicyLatencyMs ?? 'NULL') + "\n" +
  ") ON CONFLICT`,
      );
    }
    // ON CONFLICT update
    code = code.replace(
      'source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall\n" +',
      'source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall,\n" +\n"  response_policy_warning_rate = EXCLUDED.response_policy_warning_rate,\n" +\n"  response_policy_limitation_rate = EXCLUDED.response_policy_limitation_rate,\n" +\n"  response_policy_clarification_rate = EXCLUDED.response_policy_clarification_rate,\n" +\n"  response_policy_abstention_rate = EXCLUDED.response_policy_abstention_rate,\n" +\n"  response_policy_decline_rate = EXCLUDED.response_policy_decline_rate,\n" +\n"  response_policy_conflict_explanation_rate = EXCLUDED.response_policy_conflict_explanation_rate,\n" +\n"  response_policy_low_confidence_handling_rate = EXCLUDED.response_policy_low_confidence_handling_rate,\n" +\n"  avg_response_policy_latency_ms = EXCLUDED.avg_response_policy_latency_ms\n" +',
    );

    n.parameters.jsCode = code;
    writeFileSync(new URL('./_e25-after-metrics.js', import.meta.url), code);
    await save('1uITQcJ5jSNXErOM', nodes, rows[0].connections, rows[0].name, 'e25 metrics policy');
  } else {
    console.log('metrics already patched');
  }
}

// ========== 4) Backup RQ tables ==========
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='A16PhhWFr0Za9X3B'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Exportar tabelas app');
  let q = n.parameters.query;
  if (!q.includes('ai_response_quality_configs')) {
    q = q.replace(
      "'ai_retrieval_config_versions', (SELECT COALESCE(json_agg(row_to_json(arv)), '[]'::json) FROM ai_retrieval_config_versions arv),",
      `'ai_retrieval_config_versions', (SELECT COALESCE(json_agg(row_to_json(arv)), '[]'::json) FROM ai_retrieval_config_versions arv),
    'ai_response_quality_configs', (SELECT COALESCE(json_agg(row_to_json(rqc)), '[]'::json) FROM ai_response_quality_configs rqc),
    'ai_response_quality_config_versions', (SELECT COALESCE(json_agg(row_to_json(rqv)), '[]'::json) FROM ai_response_quality_config_versions rqv),`,
    );
    n.parameters.query = q;
    await save('A16PhhWFr0Za9X3B', nodes, rows[0].connections, rows[0].name, 'e25 backup RQ');
  } else {
    console.log('backup already has RQ tables');
  }
}

// ========== 5) Health 7d from lab + audit ==========
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const probe = nodes.find((n) => n.name === 'Probe database');
  let query = String(probe.parameters.query);
  if (!query.includes('rq_warnings_7d')) {
    // append policy stats subquery fields into rq_stats if possible
    if (query.includes('AS rq_policy_enabled')) {
      query = query.replace(
        'AS rq_policy_enabled',
        `AS rq_policy_enabled,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_warning IS TRUE) AS rq_warnings_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_strategy = 'ANSWER_WITH_LIMITATION') AS rq_limitations_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_clarification_required IS TRUE) AS rq_clarifications_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_abstained IS TRUE) AS rq_abstentions_7d,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_declined IS TRUE) AS rq_declines_7d,
    (SELECT COUNT(*)::int FROM audit_logs WHERE occurred_at >= NOW() - INTERVAL '7 days' AND action LIKE 'AI_RESPONSE_POLICY_%' AND success IS FALSE) AS rq_policy_failures_7d,
    (SELECT ROUND(AVG(response_policy_latency_ms)::numeric, 2) FROM ai_test_results WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_latency_ms IS NOT NULL) AS rq_avg_policy_latency_ms,
    (SELECT COALESCE(jsonb_object_agg(strategy, cnt), '{}'::jsonb) FROM (
       SELECT COALESCE(response_policy_strategy, 'UNKNOWN') AS strategy, COUNT(*)::int AS cnt
       FROM ai_test_results
       WHERE created_at >= NOW() - INTERVAL '7 days' AND response_policy_strategy IS NOT NULL
       GROUP BY 1
     ) s) AS rq_strategy_dist_7d`,
      );
      // ensure selected in outer query
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
  if (prep && !prep.parameters.jsCode.includes('warnings7d')) {
    // map from db
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'policyEnabled: String(dbItem.rq_policy_enabled || \'false\') === \'true\',',
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
    ac = ac.replace(/warnings7d: null,/g, 'warnings7d: e.warnings7d != null ? Number(e.warnings7d) : 0,');
    ac = ac.replace(/limitations7d: null,/g, 'limitations7d: e.limitations7d != null ? Number(e.limitations7d) : 0,');
    ac = ac.replace(/clarifications7d: null,/g, 'clarifications7d: e.clarifications7d != null ? Number(e.clarifications7d) : 0,');
    ac = ac.replace(/abstentions7d: null,/g, 'abstentions7d: e.abstentions7d != null ? Number(e.abstentions7d) : 0,');
    ac = ac.replace(/declines7d: null,/g, 'declines7d: e.declines7d != null ? Number(e.declines7d) : 0,');
    ac = ac.replace(/policyFailures7d: null,/g, 'policyFailures7d: e.policyFailures7d != null ? Number(e.policyFailures7d) : 0,');
    ac = ac.replace(
      /averagePolicyLatencyMs: null,/g,
      'averagePolicyLatencyMs: e.averagePolicyLatencyMs != null ? Number(e.averagePolicyLatencyMs) : null,',
    );
    ac = ac.replace(
      /strategyDistribution7d: null,/g,
      'strategyDistribution7d: e.strategyDistribution7d || null,',
    );
    agg.parameters.jsCode = ac;
  }

  await save('qAyYc9DrHIqe4L9i', nodes, rows[0].connections, rows[0].name, 'e25 health policy 7d');
}

await c.end();
console.log('finalize core done');
