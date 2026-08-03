#!/usr/bin/env node
/**
 * Retest after Avaliar+conflict fixes: smoke metrics, admin CRUD, A/B subset.
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_LEGACY = '3007bd85-782e-4057-bd48-63e7cb060d73';
const CTX_BUDGET = '7587c86b-8db3-44c0-9881-1e996abda89a';

const out = { at: new Date().toISOString(), tests: [], ab: {}, admin: {}, production: {} };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 400) : '');
}

async function login() {
  const j = await (
    await fetch(`${BASE}/webhook/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'compras@oftalmocentrouberaba.com.br',
        password: '12345678',
      }),
    })
  ).json();
  return j?.data?.accessToken || j?.data?.token;
}

async function api(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  return { status: r.status, j, data: j?.data ?? j };
}

function pickVersion(data) {
  return data?.version || data?.item || data?.created || data;
}

const token = await login();
ok('login', !!token);

const goodCfg = {
  mode: 'BUDGETED',
  modelName: 'gpt-4.1-mini',
  contextLimitTokens: 16000,
  reservedResponseTokens: 800,
  reservedSystemTokens: 1500,
  safetyMarginTokens: 400,
  maxChunks: 10,
  maxChunksPerDocument: 3,
  minChunkScore: 0.05,
  enableNeighbors: false,
  maxNeighborsPerChunk: 0,
  enableRedundancyRemoval: true,
  redundancyThreshold: 0.9,
  enableConflictPreservation: true,
  tokenizer: 'conservative_char_div_3',
  notes: 'tmp-etapa21.1-retest',
};

const created = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'BUDGETED',
  versionLabel: `context-tmp-211b-${Date.now()}`,
  configuration: goodCfg,
  notes: 'retest',
});
const createdVersion = pickVersion(created.data);
ok('Create DRAFT', (created.status === 200 || created.status === 201) && !!createdVersion?.id, {
  status: created.status,
  id: createdVersion?.id,
  keys: Object.keys(created.data || {}),
});
out.admin.tempId = createdVersion?.id;

if (createdVersion?.id) {
  const upd = await api('PUT', '/webhook/system/ai-context/update', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, maxChunks: 8 },
  });
  ok('Update DRAFT', upd.status === 200, { status: upd.status });

  const updPub = await api('PUT', '/webhook/system/ai-context/update', token, {
    versionId: CTX_LEGACY,
    configuration: goodCfg,
  });
  ok('Update PUBLISHED bloqueado', [400, 403, 409].includes(updPub.status), { status: updPub.status });

  const vOk = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, maxChunks: 8 },
  });
  ok('Validate válido', vOk.status === 200, { status: vOk.status, data: vOk.data });

  const vStr = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, enableNeighbors: 'false' },
  });
  ok('Validate bool string', vStr.status === 400, { status: vStr.status });

  const pubNo = await api('POST', '/webhook/system/ai-context/publish', token, {
    versionId: createdVersion.id,
  });
  ok('Publish sem run bloqueado', [400, 409].includes(pubNo.status), { status: pubNo.status });
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function runCase(contextConfigVersionId) {
  const c = await client.query(
    `SELECT id, code FROM ai_test_cases WHERE status='active' AND group_name='Planilhas' ORDER BY code LIMIT 1`,
  );
  const caseId = c.rows[0]?.id;
  const r = await api('POST', '/webhook/system/ai-eval/run-case', token, {
    caseId,
    contextConfigVersionId,
    contextConfigOverrideAllowed: true,
  });
  return { caseCode: c.rows[0]?.code, status: r.status, runId: r.data?.run?.id, runStatus: r.data?.run?.status, results: r.data?.results };
}

const smokeA = await runCase(CTX_LEGACY);
ok('Smoke LEGACY', smokeA.status === 200 && smokeA.runStatus !== 'FAILED', smokeA);
const smokeB = await runCase(CTX_BUDGET);
ok('Smoke BUDGETED', smokeB.status === 200 && smokeB.runStatus !== 'FAILED', smokeB);

async function metricsFor(runId) {
  if (!runId) return null;
  const r = await client.query(
    `SELECT context_mode, estimated_context_tokens, included_chunk_count, context_utilization_rate,
            relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context,
            conflict_detected, conflict_type, insufficient_context, context_fallback_used, score, verdict
     FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  return r.rows;
}

out.ab.smokeA = { ...smokeA, metrics: await metricsFor(smokeA.runId) };
out.ab.smokeB = { ...smokeB, metrics: await metricsFor(smokeB.runId) };
ok('Métricas por caso', (out.ab.smokeA.metrics || []).length > 0, out.ab.smokeA.metrics?.[0]);
ok(
  'Conflito falso positivo reduzido (planilha)',
  !(out.ab.smokeA.metrics || []).some((m) => m.conflict_detected === true) ||
    (out.ab.smokeA.metrics || []).every((m) => m.conflict_type === 'NO_CONFLICT' || m.conflict_detected === false),
  out.ab.smokeA.metrics?.[0],
);

// A/B groups with real names
const groups = ['RH', 'Planilhas', 'Casos negativos', 'OCR', 'Financeiro'];
async function runDataset(contextConfigVersionId, groupName) {
  return api('POST', '/webhook/system/ai-eval/run-dataset', token, {
    groupName,
    contextConfigVersionId,
    contextConfigOverrideAllowed: true,
  });
}

out.ab.A = [];
out.ab.B = [];
for (const g of groups) {
  console.log('Running A', g);
  const a = await runDataset(CTX_LEGACY, g);
  out.ab.A.push({ group: g, status: a.status, runId: a.data?.run?.id, runStatus: a.data?.run?.status, total: a.data?.run?.totalCases, score: a.data?.metrics?.overallScore, hall: a.data?.metrics?.hallucinationCount });
  console.log('Running B', g);
  const b = await runDataset(CTX_BUDGET, g);
  out.ab.B.push({ group: g, status: b.status, runId: b.data?.run?.id, runStatus: b.data?.run?.status, total: b.data?.run?.totalCases, score: b.data?.metrics?.overallScore, hall: b.data?.metrics?.hallucinationCount });
}

async function agg(runId) {
  if (!runId) return null;
  const r = await client.query(
    `SELECT COUNT(*)::int n,
            AVG(score)::float avg_score,
            SUM(CASE WHEN is_hallucination THEN 1 ELSE 0 END)::int hall,
            AVG(estimated_context_tokens)::float avg_tokens,
            AVG(context_utilization_rate)::float avg_util,
            AVG(included_chunk_count)::float avg_chunks,
            AVG(redundancy_rate)::float avg_redundancy,
            SUM(CASE WHEN overflow_detected THEN 1 ELSE 0 END)::int overflow,
            SUM(CASE WHEN empty_context THEN 1 ELSE 0 END)::int empty_ctx,
            SUM(CASE WHEN insufficient_context THEN 1 ELSE 0 END)::int insuff,
            SUM(CASE WHEN context_fallback_used THEN 1 ELSE 0 END)::int fallback,
            SUM(CASE WHEN conflict_detected THEN 1 ELSE 0 END)::int conflicts,
            SUM(CASE WHEN verdict='PASS' THEN 1 ELSE 0 END)::int passed,
            SUM(CASE WHEN verdict='FAIL' THEN 1 ELSE 0 END)::int failed
     FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  return r.rows[0];
}

out.ab.detailsA = [];
out.ab.detailsB = [];
for (const x of out.ab.A) out.ab.detailsA.push({ ...x, agg: await agg(x.runId) });
for (const x of out.ab.B) out.ab.detailsB.push({ ...x, agg: await agg(x.runId) });

function roll(details) {
  const o = { n: 0, hall: 0, overflow: 0, empty: 0, insuff: 0, fallback: 0, conflicts: 0, passed: 0, failed: 0, scoreW: 0, tokensW: 0, utilW: 0, utilN: 0 };
  for (const d of details) {
    const a = d.agg;
    if (!a) continue;
    o.n += a.n || 0;
    o.hall += a.hall || 0;
    o.overflow += a.overflow || 0;
    o.empty += a.empty_ctx || 0;
    o.insuff += a.insuff || 0;
    o.fallback += a.fallback || 0;
    o.conflicts += a.conflicts || 0;
    o.passed += a.passed || 0;
    o.failed += a.failed || 0;
    if (a.avg_score != null) o.scoreW += a.avg_score * a.n;
    if (a.avg_tokens != null) o.tokensW += a.avg_tokens * a.n;
    if (a.avg_util != null) {
      o.utilW += a.avg_util * a.n;
      o.utilN += a.n;
    }
  }
  return {
    ...o,
    avgScore: o.n ? o.scoreW / o.n : null,
    avgTokens: o.n ? o.tokensW / o.n : null,
    avgUtil: o.utilN ? o.utilW / o.utilN : null,
  };
}

const sumA = roll(out.ab.detailsA);
const sumB = roll(out.ab.detailsB);
out.ab.sumA = sumA;
out.ab.sumB = sumB;

let verdict = 'INCONCLUSIVE';
if (sumA.n > 0 && sumB.n > 0) {
  const criticalReg =
    sumB.hall > sumA.hall || sumB.insuff > sumA.insuff || sumB.overflow > 0 || sumB.failed > sumA.failed + 1;
  if (criticalReg) verdict = 'REGRESSED';
  else if (sumB.avgScore != null && sumA.avgScore != null) {
    if (sumB.avgScore >= sumA.avgScore - 0.5 && (sumB.avgTokens == null || sumA.avgTokens == null || sumB.avgTokens <= sumA.avgTokens * 1.05)) {
      verdict = sumB.avgScore > sumA.avgScore + 1 ? 'IMPROVED' : 'NEUTRAL';
    } else if (sumB.avgScore < sumA.avgScore - 2) verdict = 'REGRESSED';
    else verdict = 'NEUTRAL';
  }
}
out.ab.verdict = verdict;
ok('A/B com resultados', sumA.n > 0 && sumB.n > 0, { sumA, sumB, verdict });

const cmp = await api(
  'GET',
  `/webhook/system/ai-context/compare?runAId=${out.ab.A[0]?.runId || ''}&runBId=${out.ab.B[0]?.runId || ''}`,
  token,
);
ok('Compare', cmp.status === 200, { verdict: cmp.data?.verdict, differences: cmp.data?.differences });

// Secrets / production
const secrets = await client.query(
  `SELECT key, value FROM app_secrets WHERE key ILIKE '%context%' OR key ILIKE '%retrieval%' ORDER BY key`,
);
out.production.secrets = secrets.rows;
const ctx = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT')`,
);
const ret = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
out.production.context = ctx.rows;
out.production.retrieval = ret.rows;
ok(
  'Produção LEGACY',
  ctx.rows.some((r) => r.version_label === 'context-v1' && r.status === 'PUBLISHED') &&
    !ctx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'PUBLISHED'),
);
ok('Retrieval HYBRID', ret.rows.some((r) => r.version_label === 'hybrid-v1' && r.status === 'PUBLISHED'));
ok('Rerank DRAFT', ret.rows.some((r) => r.version_label === 'hybrid-rerank-v1' && r.status === 'DRAFT'));

if (createdVersion?.id) {
  await client.query(`UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1 AND status='DRAFT'`, [
    createdVersion.id,
  ]);
  ok('Temp archived', true, { id: createdVersion.id });
}

const publishRec =
  verdict === 'IMPROVED' || verdict === 'NEUTRAL'
    ? 'NÃO PUBLICAR automaticamente — manter DRAFT; critérios de qualidade ok no subset, mas publicação exige aprovação explícita.'
    : 'NÃO PUBLICAR — regressão ou inconclusivo no A/B.';
out.ab.publishRecommendation = publishRec;

await client.end();
writeFileSync(new URL('./_c211-retest.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\npass', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
console.log('verdict', verdict);
console.log(publishRec);
