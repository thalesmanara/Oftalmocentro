#!/usr/bin/env node
/** Part2c: Consulta IA versionId override + retrievalMeta; EXECUTAR TESTE/DATASET/MÉTRICAS */
import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const IDS = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const out = {};

async function patch(id, fn) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : rows[0].connections,
  };
  const result = fn(wf) || {};
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), id],
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), id, wf.activeVersionId],
    );
  }
  return { id, name: wf.name, ...result };
}

// ---- Consulta IA ----
out.consulta = await patch(IDS.CONSULTA || '8EXk5RkFW5cxnenL', (wf) => {
  const load = wf.nodes.find((n) => n.name === 'Carregar retrieval config');
  if (load) {
    load.parameters.workflowInputs.value = {
      requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
      modeOverride: '',
      versionId:
        "={{ (() => { const b=$('Normalizar request').first().json.body||{}; const q=$('Normalizar request').first().json.query||{}; return String(b.retrievalConfigVersionId||q.retrievalConfigVersionId||'').trim(); })() }}",
    };
  }
  const prep = wf.nodes.find((n) => n.name === 'Preparar seleção retrieval');
  // keep as is
  const montar = wf.nodes.find((n) => n.name === 'Montar resposta');
  if (montar && !montar.parameters.jsCode.includes('retrievalMeta')) {
    montar.parameters.jsCode = `const ctx = $('Montar contexto').first().json;
const prompt = $('Aplicar prompt carregado').first().json || {};
const answer = $json.output?.[0]?.content?.[0]?.text ?? '';
const sources = (ctx.sources || []).map((s) => ({
  ...s,
  expirationDate: s.expirationDate ?? s.vigencyDate ?? null,
}));
const requestId = $('Normalizar request').first().json.requestId;
let rankingMeta = null;
let rankedDocumentIds = [];
let fallbackUsed = false;
let retrievalConfigVersion = null;
let modeOverrideUsed = false;
try {
  const ranked = $('Resolver ranking final').all().map(i => i.json).filter(Boolean);
  if (ranked.length) {
    rankingMeta = ranked[0].rankingMetadata || null;
    fallbackUsed = !!ranked[0].fallbackUsed || !!(rankingMeta && rankingMeta.fallbackUsed);
    retrievalConfigVersion = ranked[0].retrievalConfigVersion || (rankingMeta && rankingMeta.versionLabel) || null;
    rankedDocumentIds = ranked.map(r => r.documentId || r.document_id).filter(Boolean);
  }
} catch (_) {}
try {
  const cfg = $('Carregar retrieval config').first().json || {};
  modeOverrideUsed = !!cfg.modeOverrideUsed;
  if (!retrievalConfigVersion) retrievalConfigVersion = cfg.versionLabel || null;
} catch (_) {}
const retrievalMeta = {
  mode: (rankingMeta && rankingMeta.mode) || null,
  versionLabel: retrievalConfigVersion,
  candidateCount: rankingMeta && rankingMeta.candidateCount != null ? Number(rankingMeta.candidateCount) : null,
  selectedCount: rankingMeta && rankingMeta.selectedCount != null ? Number(rankingMeta.selectedCount) : rankedDocumentIds.length,
  durationMs: rankingMeta && rankingMeta.durationMs != null ? Number(rankingMeta.durationMs) : null,
  fallbackUsed,
  modeOverrideUsed,
  rankedDocumentIds,
};
return [{
  json: {
    data: {
      question: ctx.question,
      answer,
      sources,
      classification: ctx.classification,
      retrievalMeta,
    },
    statusCode: 200,
    requestId,
    promptMeta: {
      promptVersionId: prompt.promptVersionId || null,
      promptCode: prompt.promptCode || null,
      versionNumber: prompt.versionNumber != null ? prompt.versionNumber : null,
      contentHash: prompt.contentHash || null,
      modelName: prompt.modelName || null,
    },
  },
}];`;
  }
  return { patched: ['load', 'montar'] };
});

// ---- EXECUTAR TESTE: accept retrievalConfigVersionId, pass to Consulta, compute retrieval metrics ----
out.teste = await patch('KdpEmEGHNlPICOa4', (wf) => {
  const trigger = wf.nodes.find((n) => n.name === 'Trigger');
  const vals = trigger.parameters.workflowInputs.values || [];
  if (!vals.some((v) => v.name === 'retrievalConfigVersionId')) {
    vals.push({ name: 'retrievalConfigVersionId', type: 'string' });
  }
  trigger.parameters.workflowInputs.values = vals;

  const http = wf.nodes.find((n) => n.name === 'Chamar Consulta IA');
  if (http) {
    http.parameters.jsonBody =
      "={{ JSON.stringify(Object.assign({ question: $json.question }, $json.prompt_version_id ? { promptVersionId: $json.prompt_version_id } : {}, $('Trigger').first().json.retrievalConfigVersionId ? { retrievalConfigVersionId: $('Trigger').first().json.retrievalConfigVersionId } : {})) }}";
  }

  // Ensure Carregar caso passes retrieval id - usually joins trigger fields into case row; check node
  const carregar = wf.nodes.find((n) => n.name === 'Carregar caso');
  // Avaliar e montar insert - extend for retrieval metrics
  const avaliar = wf.nodes.find((n) => n.name === 'Avaliar e montar insert');
  if (avaliar && !avaliar.parameters.jsCode.includes('rankedDocumentIds')) {
    avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
      'const sources = Array.isArray(data.sources) ? data.sources : [];',
      `const sources = Array.isArray(data.sources) ? data.sources : [];
const retrievalMeta = data.retrievalMeta && typeof data.retrievalMeta === 'object' ? data.retrievalMeta : {};
const rankedDocumentIds = Array.isArray(retrievalMeta.rankedDocumentIds) ? retrievalMeta.rankedDocumentIds.map(String) : sourceIdsFrom(sources);
function sourceIdsFrom(srcs){ return (srcs||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean); }`,
    );
    // Fix order - sourceIds is defined later. Better inject after sourceIds definition.
    avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
      `const sources = Array.isArray(data.sources) ? data.sources : [];
const retrievalMeta = data.retrievalMeta && typeof data.retrievalMeta === 'object' ? data.retrievalMeta : {};
const rankedDocumentIds = Array.isArray(retrievalMeta.rankedDocumentIds) ? retrievalMeta.rankedDocumentIds.map(String) : sourceIdsFrom(sources);
function sourceIdsFrom(srcs){ return (srcs||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean); }`,
      'const sources = Array.isArray(data.sources) ? data.sources : [];\nconst retrievalMeta = data.retrievalMeta && typeof data.retrievalMeta === \'object\' ? data.retrievalMeta : {};',
    );

    avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
      'const sourceIds=(sources||[]).map(s=>String(s.documentId||s.document_id||\'\')).filter(Boolean);',
      // this is inside scoreCase function - leave it
      'const sourceIds=(sources||[]).map(s=>String(s.documentId||s.document_id||\'\')).filter(Boolean);',
    );

    // After scored = scoreCase(...), add retrieval metric computation and extend SQL
    if (!avaliar.parameters.jsCode.includes('expectedDocumentRank')) {
      avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
        'if (isInternalError) { scored.verdict = \'ERROR\'; scored.isInternalError = true; }',
        `if (isInternalError) { scored.verdict = 'ERROR'; scored.isInternalError = true; }
const rankedDocumentIds = Array.isArray(retrievalMeta.rankedDocumentIds) && retrievalMeta.rankedDocumentIds.length
  ? retrievalMeta.rankedDocumentIds.map(String)
  : sources.map(s => String(s.documentId || s.document_id || '')).filter(Boolean);
const expectedIds = [];
if (caso.expected_document_id) expectedIds.push(String(caso.expected_document_id));
if (Array.isArray(caso.expected_document_ids)) for (const id of caso.expected_document_ids) if (id) expectedIds.push(String(id));
const uniqExpected = [...new Set(expectedIds)];
const K = rankedDocumentIds.length || 0;
let expectedDocumentRank = null;
let recallAtK = null;
let precisionAtK = null;
let mrr = null;
let hitRate = null;
let sourcePrecision = null;
let sourceRecall = null;
let retrievalCasesEvaluable = false;
if (uniqExpected.length > 0 && K > 0) {
  retrievalCasesEvaluable = true;
  const hitSet = new Set(rankedDocumentIds.filter(id => uniqExpected.includes(id)));
  recallAtK = hitSet.size / uniqExpected.length;
  precisionAtK = rankedDocumentIds.filter(id => uniqExpected.includes(id)).length / K;
  const firstIdx = rankedDocumentIds.findIndex(id => uniqExpected.includes(id));
  expectedDocumentRank = firstIdx >= 0 ? firstIdx + 1 : null;
  mrr = firstIdx >= 0 ? 1 / (firstIdx + 1) : 0;
  hitRate = firstIdx >= 0 ? 1 : 0;
  sourcePrecision = precisionAtK;
  sourceRecall = recallAtK;
} else if (uniqExpected.length === 0) {
  // no reference: leave nulls (not zero)
  retrievalCasesEvaluable = false;
}
const candidatesRetrieved = retrievalMeta.candidateCount != null ? Number(retrievalMeta.candidateCount) : K;
const candidatesReranked = retrievalMeta.selectedCount != null ? Number(retrievalMeta.selectedCount) : K;
const rerankLatencyMs = retrievalMeta.durationMs != null ? Number(retrievalMeta.durationMs) : null;
const fallbackUsed = !!retrievalMeta.fallbackUsed;
const retrievalConfigVersion = retrievalMeta.versionLabel || null;
const retrievalMode = retrievalMeta.mode || null;`,
      );

      // Extend INSERT - replace SQL building section carefully
      avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
        '"  ocr_used, sheet_name, headers_json, prompt_version, model_name, prompt_version_id\\n" +',
        '"  ocr_used, sheet_name, headers_json, prompt_version, model_name, prompt_version_id,\\n" +\n' +
          '"  candidates_retrieved, candidates_reranked, expected_document_rank, retrieval_latency_ms, rerank_latency_ms,\\n" +\n' +
          '"  final_context_count, retrieval_config_version, fallback_used, rerank_score, retrieval_mode,\\n" +\n' +
          '"  source_precision, source_recall, retrieval_ranked_document_ids\\n" +',
      );
      // Old string might use different escaping - check
      if (!avaliar.parameters.jsCode.includes('candidates_retrieved')) {
        avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
          'prompt_version, model_name, prompt_version_id\n" +',
          'prompt_version, model_name, prompt_version_id,\n' +
            '  candidates_retrieved, candidates_reranked, expected_document_rank, retrieval_latency_ms, rerank_latency_ms,\n' +
            '  final_context_count, retrieval_config_version, fallback_used, retrieval_mode,\n' +
            '  source_precision, source_recall, retrieval_ranked_document_ids\n" +',
        );
      }
      if (!avaliar.parameters.jsCode.includes('candidates_retrieved')) {
        // append before VALUES close - use a simpler approach: patch RETURNING and VALUES end
        avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
          `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\\n" +
  ") RETURNING`,
          `"  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + ",\\n" +
  "  " + (candidatesRetrieved == null ? 'NULL' : String(candidatesRetrieved)) + ", " + (candidatesReranked == null ? 'NULL' : String(candidatesReranked)) + ", " + (expectedDocumentRank == null ? 'NULL' : String(expectedDocumentRank)) + ",\\n" +
  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +
  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\\n" +
  "  " + (sourcePrecision == null ? 'NULL' : String(sourcePrecision)) + ", " + (sourceRecall == null ? 'NULL' : String(sourceRecall)) + ",\\n" +
  "  '" + j(rankedDocumentIds) + "'::jsonb\\n" +
  ") RETURNING`,
        );
      }
      // Also need column list - if still missing, force rewrite of insert header
      if (!avaliar.parameters.jsCode.includes('candidates_retrieved,')) {
        console.log('WARN: could not patch INSERT columns automatically');
      }

      // Extend return json
      avaliar.parameters.jsCode = avaliar.parameters.jsCode.replace(
        'promptVersionId: caso.prompt_version_id || null,\n}}];',
        `promptVersionId: caso.prompt_version_id || null,
  expectedDocumentRank, recallAtK, precisionAtK, mrr, hitRate, sourcePrecision, sourceRecall,
  candidatesRetrieved, candidatesReranked, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode,
  rankedDocumentIds, retrievalCasesEvaluable,
}}];`,
      );
    }
  }
  return { patched: true };
});

// Fix EXECUTAR TESTE insert more reliably by rewriting Avaliar node from file if patch incomplete
{
  const wf = await (async () => {
    const { rows } = await client.query(`SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
    return {
      nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
      connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
      activeVersionId: rows[0].activeVersionId,
    };
  })();
  const avaliar = wf.nodes.find((n) => n.name === 'Avaliar e montar insert');
  out.testeHasCandidates = avaliar.parameters.jsCode.includes('candidates_retrieved');
  out.testeHasRanked = avaliar.parameters.jsCode.includes('rankedDocumentIds');
  writeFileSync(new URL('./_avaliar-patched-check.js', import.meta.url), avaliar.parameters.jsCode.slice(0, 500) + '\n...\n' + avaliar.parameters.jsCode.slice(-800));
}

// ---- DATASET: pass retrievalConfigVersionId, stamp run ----
out.dataset = await patch('12t0Ol6zWQJgAKPC', (wf) => {
  const trigger = wf.nodes.find((n) => n.name === 'Trigger');
  const vals = trigger.parameters.workflowInputs.values || [];
  for (const name of ['retrievalConfigVersionId', 'groupName', 'authorization']) {
    if (name === 'authorization' || name === 'groupName') continue;
    if (!vals.some((v) => v.name === name)) vals.push({ name, type: 'string' });
  }
  trigger.parameters.workflowInputs.values = vals;

  const inserir = wf.nodes.find((n) => n.name === 'Inserir run');
  if (inserir && inserir.parameters.query && !inserir.parameters.query.includes('mode_override_used')) {
    let q = inserir.parameters.query;
    if (q.includes('retrieval_config_version)') && !q.includes('mode_override_used')) {
      q = q.replace(
        'retrieval_mode, retrieval_config_version)',
        'retrieval_mode, retrieval_config_version, retrieval_config_version_id, mode_override_used)',
      );
      // Fix select values - append before FROM
      if (q.includes("key='retrieval_active_version'")) {
        q = q.replace(
          /COALESCE\(\(SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1\), 'hybrid-v1'\)/,
          `CASE WHEN NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL THEN (SELECT version_label FROM ai_retrieval_config_versions WHERE id=NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'')::uuid) ELSE COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1), 'hybrid-v1') END`,
        );
        // Also mode from version when override
        q = q.replace(
          /COALESCE\(\(SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1\), 'HYBRID'\)/,
          `CASE WHEN NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL THEN (SELECT mode FROM ai_retrieval_config_versions WHERE id=NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'')::uuid) ELSE COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), 'HYBRID') END`,
        );
        // Add version id and override flag before FROM
        q = q.replace(
          /\nFROM \(SELECT 1\) x/,
          `,\n  NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'')::uuid,\n  (NULLIF(TRIM('={{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL)\nFROM (SELECT 1) x`,
        );
      }
      inserir.parameters.query = q;
    }
  }

  const execCaso = wf.nodes.find((n) => n.name === 'Executar caso');
  if (execCaso?.parameters?.workflowInputs?.value) {
    execCaso.parameters.workflowInputs.value.retrievalConfigVersionId =
      "={{ $('Trigger').first().json.retrievalConfigVersionId || '' }}";
  }
  return { patched: true };
});

// ---- CALCULAR MÉTRICAS: add retrieval aggregates ----
out.metrics = await patch('1uITQcJ5jSNXErOM', (wf) => {
  const agg = wf.nodes.find((n) => n.name === 'Agregar métricas' || (n.parameters?.jsCode || '').includes('aggregateMetrics'));
  if (!agg) return { missing: true };
  if (agg.parameters.jsCode.includes('recall_at_k')) return { already: true };

  // Extend mapped fields and aggregateMetrics + SQL
  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    'sources: Array.isArray(r.sources) ? r.sources : [],\n}));',
    `sources: Array.isArray(r.sources) ? r.sources : [],
  expectedDocumentRank: r.expected_document_rank != null ? Number(r.expected_document_rank) : null,
  sourcePrecision: r.source_precision != null ? Number(r.source_precision) : null,
  sourceRecall: r.source_recall != null ? Number(r.source_recall) : null,
  candidatesRetrieved: r.candidates_retrieved != null ? Number(r.candidates_retrieved) : null,
  candidatesReranked: r.candidates_reranked != null ? Number(r.candidates_reranked) : null,
  rerankLatencyMs: r.rerank_latency_ms != null ? Number(r.rerank_latency_ms) : null,
  fallbackUsed: !!r.fallback_used,
  rankedDocumentIds: Array.isArray(r.retrieval_ranked_document_ids) ? r.retrieval_ranked_document_ids : [],
}));`,
  );

  agg.parameters.jsCode = agg.parameters.jsCode.replace(
    'return{precision,recall,documentCoverage,',
    `// retrieval metrics
const evalRows=results.filter(r=>r.sourcePrecision!=null || r.expectedDocumentRank!=null || (Array.isArray(r.rankedDocumentIds)&&r.rankedDocumentIds.length&&r.expectedDocumentId));
let recallAtK=null, precisionAtK=null, mrr=null, hitRate=null, sourcePrecisionAgg=null, sourceRecallAgg=null;
let retrievalCasesEvaluated=0, retrievalCasesSkipped=results.length;
const rr=[]; const pp=[]; const mm=[]; const hh=[]; const sp=[]; const sr=[];
for(const r of results){
  const expected=r.expectedDocumentId? [String(r.expectedDocumentId)] : [];
  const ranked=(r.rankedDocumentIds||[]).map(String);
  if(!expected.length){ continue; }
  retrievalCasesEvaluated+=1;
  if(!ranked.length){ hh.push(0); mm.push(0); continue; }
  const hits=ranked.filter(id=>expected.includes(id));
  const rec=hits.length/expected.length; rr.push(rec);
  const prec=hits.length/ranked.length; pp.push(prec);
  const idx=ranked.findIndex(id=>expected.includes(id));
  mm.push(idx>=0?1/(idx+1):0); hh.push(idx>=0?1:0);
  if(r.sourcePrecision!=null) sp.push(Number(r.sourcePrecision)); else sp.push(prec);
  if(r.sourceRecall!=null) sr.push(Number(r.sourceRecall)); else sr.push(rec);
}
retrievalCasesSkipped=results.length-retrievalCasesEvaluated;
const avg=a=>a.length?Math.round((a.reduce((x,y)=>x+y,0)/a.length)*10000)/10000:null;
recallAtK=avg(rr); precisionAtK=avg(pp); mrr=avg(mm); hitRate=avg(hh);
sourcePrecisionAgg=avg(sp); sourceRecallAgg=avg(sr);
const rerankLats=results.map(r=>Number(r.rerankLatencyMs)).filter(Number.isFinite);
const avgRerankLatencyMs=rerankLats.length?Math.round(rerankLats.reduce((a,b)=>a+b,0)/rerankLats.length):null;
const fallbackCount=results.filter(r=>r.fallbackUsed).length;
return{precision,recall,documentCoverage,recallAtK,precisionAtK,mrr,hitRate,sourcePrecision:sourcePrecisionAgg,sourceRecall:sourceRecallAgg,retrievalCasesEvaluated,retrievalCasesSkipped,avgRerankLatencyMs,fallbackCount,`,
  );

  // Extend INSERT SQL columns
  if (!agg.parameters.jsCode.includes('recall_at_k')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      'top_errors, top_documents, score_formula\n" +',
      'top_errors, top_documents, score_formula, recall_at_k, precision_at_k, mrr, hit_rate,\\n" +\n' +
        '  "  avg_rerank_latency_ms, fallback_count, retrieval_cases_evaluated, retrieval_cases_skipped, source_precision, source_recall\\n" +',
    );
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      '"  \'" + j(agg.topErrors) + "\'::jsonb, \'" + j(agg.topDocuments) + "\'::jsonb, \'" + esc(agg.scoreFormula) + "\'\\n" +',
      `"  '" + j(agg.topErrors) + "'::jsonb, '" + j(agg.topDocuments) + "'::jsonb, '" + esc(agg.scoreFormula) + "',\\n" +
  "  " + (agg.recallAtK ?? 'NULL') + ", " + (agg.precisionAtK ?? 'NULL') + ", " + (agg.mrr ?? 'NULL') + ", " + (agg.hitRate ?? 'NULL') + ",\\n" +
  "  " + (agg.avgRerankLatencyMs ?? 'NULL') + ", " + (agg.fallbackCount ?? 0) + ", " + (agg.retrievalCasesEvaluated ?? 0) + ", " + (agg.retrievalCasesSkipped ?? 0) + ",\\n" +
  "  " + (agg.sourcePrecision ?? 'NULL') + ", " + (agg.sourceRecall ?? 'NULL') + "\\n" +`,
    );
    // ON CONFLICT update extras
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      'score_formula = EXCLUDED.score_formula\n" +',
      'score_formula = EXCLUDED.score_formula,\\n" +\n' +
        '  "  recall_at_k = EXCLUDED.recall_at_k, precision_at_k = EXCLUDED.precision_at_k, mrr = EXCLUDED.mrr, hit_rate = EXCLUDED.hit_rate,\\n" +\n' +
        '  "  avg_rerank_latency_ms = EXCLUDED.avg_rerank_latency_ms, fallback_count = EXCLUDED.fallback_count,\\n" +\n' +
        '  "  retrieval_cases_evaluated = EXCLUDED.retrieval_cases_evaluated, retrieval_cases_skipped = EXCLUDED.retrieval_cases_skipped,\\n" +\n' +
        '  "  source_precision = EXCLUDED.source_precision, source_recall = EXCLUDED.source_recall\\n" +',
    );
  }
  return { patched: !agg.parameters.jsCode.includes('already') };
});

// ---- run-dataset / run-case webhooks: pass retrievalConfigVersionId ----
for (const [name, key] of [
  ['POST System AI Eval Run Dataset', 'datasetWebhook'],
  ['POST System AI Eval Run Case', 'caseWebhook'],
]) {
  const { rows } = await client.query(`SELECT id FROM workflow_entity WHERE name=$1`, [name]);
  if (!rows[0]) continue;
  out[key] = await patch(rows[0].id, (wf) => {
    // Find executeWorkflow to IA - EXECUTAR DATASET / TESTE
    for (const n of wf.nodes) {
      if (n.type === 'n8n-nodes-base.executeWorkflow' && n.parameters?.workflowInputs?.value) {
        const v = n.parameters.workflowInputs.value;
        if ('groupName' in v || 'caseId' in v || n.name?.includes('dataset') || n.name?.includes('Dataset') || n.name?.includes('caso') || n.name?.includes('Caso') || n.name?.includes('Executar')) {
          v.retrievalConfigVersionId =
            "={{ ($json.body && $json.body.retrievalConfigVersionId) || ($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.retrievalConfigVersionId) || '' }}";
        }
      }
      if (n.parameters?.jsCode && n.parameters.jsCode.includes('groupName') && n.parameters.jsCode.includes('authorization') && !n.parameters.jsCode.includes('retrievalConfigVersionId')) {
        n.parameters.jsCode = n.parameters.jsCode.replace(
          'groupName:',
          "retrievalConfigVersionId: (norm.body && norm.body.retrievalConfigVersionId) || '',\n  groupName:",
        );
      }
    }
    return { patched: true };
  });
}

writeFileSync(new URL('./_part2c.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
