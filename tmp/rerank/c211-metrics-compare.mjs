#!/usr/bin/env node
/**
 * Patch Avaliar metrics formulas + create compare endpoint + publish prep.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const PROJECT = 'WbvMM1wAedTR9qrk';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// --- Avaliar: add derived metrics after context fields ---
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  let code = n.parameters.jsCode;

  if (!code.includes('redundancy_rate') && !code.includes('redundancyRate')) {
    const inject = `
const sourceCount = Array.isArray(sources) ? sources.length : (contextMeta.sourceCount != null ? Number(contextMeta.sourceCount) : null);
const overflowDetected = !!(contextMeta.truncated) || (availableContextTokens > 0 && estimatedContextTokens != null && Number(estimatedContextTokens) > Number(availableContextTokens));
const emptyContext = !!insufficientContext || (includedChunkCount === 0);
const redundancyRate = (redundancyRemovedCount != null && includedChunkCount != null && (redundancyRemovedCount + includedChunkCount) > 0)
  ? redundancyRemovedCount / (redundancyRemovedCount + includedChunkCount) : null;
let relevantContextRate = null;
let sourceCoverage = null;
const expectedIds = [];
if (caso.expected_document_id) expectedIds.push(String(caso.expected_document_id));
if (Array.isArray(caso.expected_document_ids)) for (const id of caso.expected_document_ids) if (id) expectedIds.push(String(id));
if (caso.required_source_document_id) expectedIds.push(String(caso.required_source_document_id));
const uniqExpectedDocs = [...new Set(expectedIds)];
const includedDocIds = Array.isArray(contextMeta.includedDocumentIds) ? contextMeta.includedDocumentIds.map(String) : (sources||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean);
if (uniqExpectedDocs.length > 0 && includedDocIds.length > 0) {
  const hit = includedDocIds.filter(id => uniqExpectedDocs.includes(id)).length;
  relevantContextRate = hit / includedDocIds.length;
  sourceCoverage = hit / uniqExpectedDocs.length;
} else if (uniqExpectedDocs.length === 0) {
  relevantContextRate = null;
  sourceCoverage = null;
}
const conflictType = contextMeta.conflictType || (conflictDetected ? 'POTENTIAL_CONFLICT' : 'NO_CONFLICT');
`;
    // Insert after conflictDetected assignment block
    if (code.includes('const conflictDetected = !!contextMeta.conflictDetected;')) {
      code = code.replace(
        'const conflictDetected = !!contextMeta.conflictDetected;',
        'const conflictDetected = !!contextMeta.conflictDetected;' + inject,
      );
    } else if (code.includes('contextUtilizationRate')) {
      code = code.replace(
        /const contextUtilizationRate[\s\S]*?;/,
        (m) => m + inject,
      );
    }
  }

  // Ensure INSERT includes new columns if not present
  if (!code.includes('redundancy_rate') && code.includes('context_utilization_rate')) {
    code = code.replace(
      'insufficient_context, conflict_detected, context_utilization_rate',
      'insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type',
    );
    code = code.replace(
      /(contextUtilizationRate == null \? 'NULL' : String\(contextUtilizationRate\))/,
      `$1 + ", " + (relevantContextRate == null ? 'NULL' : String(relevantContextRate)) + ", " + (sourceCoverage == null ? 'NULL' : String(sourceCoverage)) + ", " + (redundancyRate == null ? 'NULL' : String(redundancyRate)) + ", " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL')`,
    );
  }

  n.parameters.jsCode = code;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json WHERE id='KdpEmEGHNlPICOa4'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='KdpEmEGHNlPICOa4' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  console.log('Avaliar metrics formulas', {
    hasRedundancyRate: code.includes('redundancyRate'),
    hasOverflow: code.includes('overflowDetected'),
    hasRelevant: code.includes('relevantContextRate'),
  });
}

// --- Compare endpoint: clone detail skeleton lightly ---
{
  const tpl = await client.query(
    `SELECT nodes, connections FROM workflow_entity WHERE id='e4c0829578124470'`,
  );
  let nodes = typeof tpl.rows[0].nodes === 'string' ? JSON.parse(tpl.rows[0].nodes) : structuredClone(tpl.rows[0].nodes);
  let connections = typeof tpl.rows[0].connections === 'string' ? JSON.parse(tpl.rows[0].connections) : structuredClone(tpl.rows[0].connections);

  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.webhook') {
      n.id = randomUUID();
      n.webhookId = randomUUID();
      n.parameters = { path: 'system/ai-context/compare', httpMethod: 'GET', responseMode: 'responseNode', options: {} };
    }
    if (n.type === 'n8n-nodes-base.postgres') {
      n.credentials = { postgres: PG };
      n.parameters.query = `
WITH params AS (
  SELECT
    NULLIF(TRIM('{{ $json.query.runAId || "" }}'),'')::uuid AS run_a,
    NULLIF(TRIM('{{ $json.query.runBId || "" }}'),'')::uuid AS run_b
)
SELECT 'A' AS arm, r.*, m.overall_score, m.avg_duration_ms, m.hallucination_count, m.passed_count, m.failed_count, m.total_count,
  m.recall_at_k, m.precision_at_k, m.mrr, m.hit_rate
FROM ai_test_runs r
LEFT JOIN ai_test_metrics m ON m.run_id = r.id
CROSS JOIN params p
WHERE r.id = p.run_a
UNION ALL
SELECT 'B' AS arm, r.*, m.overall_score, m.avg_duration_ms, m.hallucination_count, m.passed_count, m.failed_count, m.total_count,
  m.recall_at_k, m.precision_at_k, m.mrr, m.hit_rate
FROM ai_test_runs r
LEFT JOIN ai_test_metrics m ON m.run_id = r.id
CROSS JOIN params p
WHERE r.id = p.run_b`;
      n.alwaysOutputData = true;
    }
    if (n.parameters?.jsCode && /montar|definition|versions/i.test(n.parameters.jsCode + n.name)) {
      n.parameters.jsCode = `const rows=$input.all().map(i=>i.json).filter(r=>r&&r.arm);
const norm=$('Normalizar request').first().json||{};
let userId=''; let sessionId='';
try{const auth=$('Validar auth').first().json||{}; userId=auth.userId||''; sessionId=auth.sessionId||'';}catch(_){}
const A=rows.find(r=>r.arm==='A')||null;
const B=rows.find(r=>r.arm==='B')||null;
if(!A||!B){
  return [{json:{data:{error:{code:'NOT_FOUND',message:'Runs A/B não encontrados.'}},statusCode:404,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId,sessionId}}];
}
function num(v){return v==null||v===''?null:Number(v)}
function diff(a,b){ if(a==null||b==null) return null; return Number(b)-Number(a); }
const metricsA={
  overallScore:num(A.overall_score), avgDurationMs:num(A.avg_duration_ms), hallucinationCount:num(A.hallucination_count),
  passedCount:num(A.passed_count), failedCount:num(A.failed_count), totalCount:num(A.total_count),
  recallAtK:num(A.recall_at_k), precisionAtK:num(A.precision_at_k), mrr:num(A.mrr), hitRate:num(A.hit_rate),
  contextConfigVersionId:A.context_config_version_id||null, contextModeOverrideUsed:!!A.context_mode_override_used,
  retrievalMode:A.retrieval_mode||null, retrievalConfigVersion:A.retrieval_config_version||null,
};
const metricsB={
  overallScore:num(B.overall_score), avgDurationMs:num(B.avg_duration_ms), hallucinationCount:num(B.hallucination_count),
  passedCount:num(B.passed_count), failedCount:num(B.failed_count), totalCount:num(B.total_count),
  recallAtK:num(B.recall_at_k), precisionAtK:num(B.precision_at_k), mrr:num(B.mrr), hitRate:num(B.hit_rate),
  contextConfigVersionId:B.context_config_version_id||null, contextModeOverrideUsed:!!B.context_mode_override_used,
  retrievalMode:B.retrieval_mode||null, retrievalConfigVersion:B.retrieval_config_version||null,
};
const differences={
  overallScore:diff(metricsA.overallScore, metricsB.overallScore),
  hallucinationCount:diff(metricsA.hallucinationCount, metricsB.hallucinationCount),
  avgDurationMs:diff(metricsA.avgDurationMs, metricsB.avgDurationMs),
  recallAtK:diff(metricsA.recallAtK, metricsB.recallAtK),
  precisionAtK:diff(metricsA.precisionAtK, metricsB.precisionAtK),
};
let verdict='INCONCLUSIVE';
const scoreDelta=differences.overallScore;
const hallDelta=differences.hallucinationCount;
if(scoreDelta==null){ verdict='INCONCLUSIVE'; }
else if(hallDelta!=null && hallDelta>0){ verdict='REGRESSED'; }
else if(scoreDelta>=2){ verdict='IMPROVED'; }
else if(scoreDelta<=-2){ verdict='REGRESSED'; }
else { verdict='NEUTRAL'; }
return [{json:{
  data:{
    runA:{ id:A.id, status:A.status, metrics:metricsA },
    runB:{ id:B.id, status:B.status, metrics:metricsB },
    differences,
    gains: Object.entries(differences).filter(([,v])=>typeof v==='number' && ((['hallucinationCount','avgDurationMs'].includes(_) ? false : v>0))).map(([k,v])=>({metric:k,delta:v})),
    regressions: [],
    criticalCases: [],
    verdict,
  },
  statusCode:200, requestId:norm.requestId, requestStartedAtMs:norm.requestStartedAtMs, method:norm.method, path:norm.path, userId, sessionId
}}];`;
      // fix gains filter bug - simplify
      n.parameters.jsCode = n.parameters.jsCode.replace(
        `gains: Object.entries(differences).filter(([,v])=>typeof v==='number' && ((['hallucinationCount','avgDurationMs'].includes(_) ? false : v>0))).map(([k,v])=>({metric:k,delta:v})),
    regressions: [],`,
        `gains: Object.entries(differences).filter(([k,v])=>typeof v==='number' && k==='overallScore' && v>0).map(([k,v])=>({metric:k,delta:v})),
    regressions: Object.entries(differences).filter(([k,v])=>typeof v==='number' && ((k==='overallScore'&&v<0)||(k==='hallucinationCount'&&v>0))).map(([k,v])=>({metric:k,delta:v})),`,
      );
    }
  }

  const existing = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name='SYSTEM - AI CONTEXT COMPARE'`);
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  if (!existing.rows[0]) {
    const id = randomUUID().replace(/-/g, '').slice(0, 16);
    const versionId = randomUUID();
    await client.query(
      `INSERT INTO workflow_entity (id,name,active,nodes,connections,settings,"staticData","pinData","versionId","triggerCount",meta,"parentFolderId","createdAt","updatedAt","isArchived","activeVersionId")
       VALUES ($1,'SYSTEM - AI CONTEXT COMPARE',true,$2::json,$3::json,$4::json,NULL,NULL,$5,0,$6::json,NULL,NOW(),NOW(),false,NULL)`,
      [id, nodesJson, connJson, JSON.stringify({ executionOrder: 'v1', availableInMCP: true }), versionId, JSON.stringify({ builderVariant: 'etapa21.1' })],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt") VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,'SYSTEM - AI CONTEXT COMPARE','Compare A/B runs',false,NOW(),NOW())`,
      [versionId, id, nodesJson, connJson],
    );
    await client.query(`UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar WHERE id=$2`, [
      versionId,
      id,
    ]);
    console.log('COMPARE created', id);
  } else {
    await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`, [
      nodesJson,
      connJson,
      existing.rows[0].id,
    ]);
    if (existing.rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
        [nodesJson, connJson, existing.rows[0].id, existing.rows[0].activeVersionId],
      );
    }
    console.log('COMPARE updated', existing.rows[0].id);
  }
}

await client.end();
