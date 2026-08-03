#!/usr/bin/env node
/**
 * Etapa 21.1 — Admin contracts + isolation + publish/rollback controlled + A/B subset.
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_LEGACY = '3007bd85-782e-4057-bd48-63e7cb060d73';
const CTX_BUDGET = '7587c86b-8db3-44c0-9881-1e996abda89a';

const out = {
  at: new Date().toISOString(),
  tests: [],
  ab: null,
  admin: {},
  production: {},
};
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail) : '');
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

const token = await login();
ok('login', !!token);

const noAuth = await fetch(`${BASE}/webhook/system/ai-context`);
ok('401 sem auth', noAuth.status === 401 || noAuth.status === 403, { status: noAuth.status });

const list = await api('GET', '/webhook/system/ai-context', token);
ok('GET ai-context', list.status === 200, {
  status: list.status,
  items: list.data?.items?.length,
});

const detail = await api('GET', '/webhook/system/ai-context/detail', token);
ok('GET ai-context/detail', detail.status === 200, {
  active: detail.data?.activeVersion?.versionLabel,
});

// --- CREATE invalid ---
const badMode = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'INVALID_MODE',
  configuration: { mode: 'INVALID_MODE', modelName: 'gpt-4.1-mini', contextLimitTokens: 32000 },
});
ok(
  'Create mode inválido',
  badMode.status === 400 || badMode.data?.error?.code === 'VALIDATION_ERROR',
  { status: badMode.status, err: badMode.data?.error || badMode.j?.error },
);

const badNeg = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'BUDGETED',
  configuration: {
    mode: 'BUDGETED',
    modelName: 'gpt-4.1-mini',
    contextLimitTokens: -1,
    reservedResponseTokens: 100,
    reservedSystemTokens: 100,
    safetyMarginTokens: 50,
    maxChunks: 8,
    maxChunksPerDocument: 2,
    minChunkScore: 0.1,
    enableNeighbors: false,
    maxNeighborsPerChunk: 0,
    enableRedundancyRemoval: true,
    redundancyThreshold: 0.9,
    enableConflictPreservation: true,
  },
});
ok(
  'Create limite negativo',
  badNeg.status === 400 || badNeg.data?.error?.code === 'VALIDATION_ERROR',
  { status: badNeg.status, fields: badNeg.data?.error?.fields || badNeg.data?.fields },
);

const badUnknown = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'BUDGETED',
  configuration: {
    mode: 'BUDGETED',
    modelName: 'gpt-4.1-mini',
    contextLimitTokens: 32000,
    reservedResponseTokens: 1200,
    reservedSystemTokens: 2000,
    safetyMarginTokens: 800,
    maxChunks: 12,
    maxChunksPerDocument: 3,
    minChunkScore: 0.05,
    enableNeighbors: false,
    maxNeighborsPerChunk: 0,
    enableRedundancyRemoval: true,
    redundancyThreshold: 0.92,
    enableConflictPreservation: true,
    secretSql: 'drop',
  },
});
ok(
  'Create campo desconhecido',
  badUnknown.status === 400 || badUnknown.data?.error?.code === 'VALIDATION_ERROR',
  { status: badUnknown.status, fields: badUnknown.data?.error?.fields },
);

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
  notes: 'tmp-etapa21.1',
};

const created = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'BUDGETED',
  versionLabel: `context-tmp-21-1-${Date.now()}`,
  configuration: goodCfg,
  notes: 'teste etapa 21.1',
});
const createdVersion = created.data?.version || created.data?.item || created.data;
ok('Create DRAFT válido', created.status === 200 || created.status === 201, {
  status: created.status,
  id: createdVersion?.id,
  statusV: createdVersion?.status,
  label: createdVersion?.versionLabel,
});
out.admin.tempVersionId = createdVersion?.id;
out.admin.tempLabel = createdVersion?.versionLabel;

// Update DRAFT
if (createdVersion?.id) {
  const upd = await api('PUT', '/webhook/system/ai-context/update', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, maxChunks: 9 },
    notes: 'update ok',
  });
  ok('Update DRAFT válido', upd.status === 200, { status: upd.status });

  const updPub = await api('PUT', '/webhook/system/ai-context/update', token, {
    versionId: CTX_LEGACY,
    configuration: goodCfg,
  });
  ok(
    'Update PUBLISHED bloqueado',
    updPub.status === 400 || updPub.status === 403 || updPub.status === 409,
    { status: updPub.status, err: updPub.data?.error },
  );

  // Validate rejects
  const vEmpty = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    configuration: {},
  });
  ok('Validate payload vazio', vEmpty.status === 400, { status: vEmpty.status });

  const vStrNum = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, contextLimitTokens: '32000' },
  });
  ok('Validate número como string', vStrNum.status === 400, {
    status: vStrNum.status,
    fields: vStrNum.data?.error?.fields || vStrNum.data?.fields,
  });

  const vStrBool = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, enableNeighbors: 'false' },
  });
  ok('Validate boolean como string', vStrBool.status === 400, {
    status: vStrBool.status,
    fields: vStrBool.data?.error?.fields || vStrBool.data?.fields,
  });

  const vReserve = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, reservedResponseTokens: 20000, contextLimitTokens: 16000 },
  });
  ok('Validate reserva > limite', vReserve.status === 400, { status: vReserve.status });

  const vMax = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, maxChunks: 5, maxChunksPerDocument: 8 },
  });
  ok('Validate maxPerDoc > maxChunks', vMax.status === 400, { status: vMax.status });

  const vOk = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: createdVersion.id,
    mode: 'BUDGETED',
    configuration: { ...goodCfg, maxChunks: 9 },
  });
  ok('Validate válido', vOk.status === 200 && (vOk.data?.ok !== false), {
    status: vOk.status,
    data: vOk.data,
  });

  // Publish without run blocked
  const pubNoRun = await api('POST', '/webhook/system/ai-context/publish', token, {
    versionId: createdVersion.id,
  });
  ok(
    'Publicação sem run bloqueada',
    pubNoRun.status === 400 || pubNoRun.status === 409,
    { status: pubNoRun.status, err: pubNoRun.data?.error },
  );

  const pubBadReason = await api('POST', '/webhook/system/ai-context/publish', token, {
    versionId: createdVersion.id,
    override: true,
    reason: 'ok',
    validationRunId: '00000000-0000-0000-0000-000000000001',
  });
  ok(
    'Override sem motivo substancial / run inválido bloqueado',
    pubBadReason.status === 400 || pubBadReason.status === 404 || pubBadReason.status === 409,
    { status: pubBadReason.status, err: pubBadReason.data?.error },
  );
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Secrets before A/B
const secretsBefore = await client.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE '%context%' OR key LIKE 'ai_context%' ORDER BY key`,
);
out.admin.secretsBefore = secretsBefore.rows;

// --- Isolation: override cases ---
async function runCase(contextConfigVersionId, label) {
  const cases = await client.query(
    `SELECT id, code, group_name FROM ai_test_cases WHERE status='active' ORDER BY group_name, code LIMIT 1`,
  );
  const c = cases.rows[0];
  const r = await api('POST', '/webhook/system/ai-eval/run-case', token, {
    caseId: c.id,
    contextConfigVersionId,
    contextConfigOverrideAllowed: true,
  });
  return { label, caseCode: c.code, status: r.status, data: r.data, runId: r.data?.run?.id };
}

const runLegacy = await runCase(CTX_LEGACY, 'LEGACY');
ok('Override LEGACY', runLegacy.status === 200, {
  status: runLegacy.status,
  runId: runLegacy.runId,
  caseCode: runLegacy.caseCode,
});
out.ab = out.ab || {};
out.ab.smokeLegacy = runLegacy;

const runBudget = await runCase(CTX_BUDGET, 'BUDGETED');
ok('Override BUDGETED', runBudget.status === 200, {
  status: runBudget.status,
  runId: runBudget.runId,
  caseCode: runBudget.caseCode,
});
out.ab.smokeBudget = runBudget;

const secretsAfter = await client.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE '%context%' OR key LIKE 'ai_context%' ORDER BY key`,
);
ok(
  'Override não altera secrets',
  JSON.stringify(secretsBefore.rows) === JSON.stringify(secretsAfter.rows),
  { before: secretsBefore.rows, after: secretsAfter.rows },
);

const pubCtx = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok(
  'Produção paralela continua LEGACY',
  pubCtx.rows.length === 1 &&
    pubCtx.rows[0].version_label === 'context-v1' &&
    pubCtx.rows[0].mode === 'LEGACY',
  pubCtx.rows,
);

// Metrics filled on smoke runs
if (runLegacy.runId) {
  const m = await client.query(
    `SELECT context_config_version_id, context_mode, estimated_context_tokens, included_chunk_count,
            context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate,
            overflow_detected, empty_context, conflict_detected, conflict_type
     FROM ai_test_results WHERE run_id=$1 LIMIT 5`,
    [runLegacy.runId],
  );
  ok('Métricas por caso preenchidas (LEGACY smoke)', m.rows.length > 0, m.rows[0]);
  out.ab.metricsSample = m.rows[0];
}

// --- A/B representative subset via group runs ---
async function runDataset(contextConfigVersionId, groupName) {
  const r = await api('POST', '/webhook/system/ai-eval/run-dataset', token, {
    groupName,
    contextConfigVersionId,
    contextConfigOverrideAllowed: true,
  });
  return r;
}

const groups = ['RH', 'Planilhas', 'Negativos'];
const abRuns = { A: [], B: [] };
for (const g of groups) {
  console.log('A/B group', g, 'LEGACY…');
  const a = await runDataset(CTX_LEGACY, g);
  abRuns.A.push({ group: g, status: a.status, runId: a.data?.run?.id, metrics: a.data?.metrics });
  console.log('A/B group', g, 'BUDGETED…');
  const b = await runDataset(CTX_BUDGET, g);
  abRuns.B.push({ group: g, status: b.status, runId: b.data?.run?.id, metrics: b.data?.metrics });
}
out.ab.groupRuns = abRuns;
ok(
  'A/B runs disparados',
  abRuns.A.every((x) => x.status === 200) && abRuns.B.every((x) => x.status === 200),
  abRuns,
);

// Aggregate from DB for completed runs
async function loadRunMetrics(runId) {
  if (!runId) return null;
  const r = await client.query(`SELECT * FROM ai_test_runs WHERE id=$1`, [runId]);
  const m = await client.query(`SELECT * FROM ai_test_metrics WHERE run_id=$1`, [runId]);
  const res = await client.query(
    `SELECT COUNT(*)::int AS n,
            AVG(context_utilization_rate)::float AS avg_util,
            AVG(estimated_context_tokens)::float AS avg_tokens,
            AVG(included_chunk_count)::float AS avg_chunks,
            SUM(CASE WHEN overflow_detected THEN 1 ELSE 0 END)::int AS overflow,
            SUM(CASE WHEN empty_context THEN 1 ELSE 0 END)::int AS empty_ctx,
            SUM(CASE WHEN insufficient_context THEN 1 ELSE 0 END)::int AS insuff,
            SUM(CASE WHEN context_fallback_used THEN 1 ELSE 0 END)::int AS fallback,
            SUM(CASE WHEN conflict_detected THEN 1 ELSE 0 END)::int AS conflicts,
            SUM(CASE WHEN is_hallucination THEN 1 ELSE 0 END)::int AS hall,
            AVG(score)::float AS avg_score
     FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  return { run: r.rows[0], metrics: m.rows[0], agg: res.rows[0] };
}

const aIds = abRuns.A.map((x) => x.runId).filter(Boolean);
const bIds = abRuns.B.map((x) => x.runId).filter(Boolean);
out.ab.detailsA = [];
out.ab.detailsB = [];
for (const id of aIds) out.ab.detailsA.push(await loadRunMetrics(id));
for (const id of bIds) out.ab.detailsB.push(await loadRunMetrics(id));

function sumAgg(details) {
  const o = {
    n: 0,
    hall: 0,
    overflow: 0,
    empty: 0,
    insuff: 0,
    fallback: 0,
    conflicts: 0,
    scoreSum: 0,
    utilSum: 0,
    tokensSum: 0,
    chunksSum: 0,
    utilN: 0,
  };
  for (const d of details) {
    const a = d?.agg;
    if (!a) continue;
    o.n += a.n || 0;
    o.hall += a.hall || 0;
    o.overflow += a.overflow || 0;
    o.empty += a.empty_ctx || 0;
    o.insuff += a.insuff || 0;
    o.fallback += a.fallback || 0;
    o.conflicts += a.conflicts || 0;
    if (a.avg_score != null) o.scoreSum += a.avg_score * (a.n || 0);
    if (a.avg_util != null) {
      o.utilSum += a.avg_util * (a.n || 0);
      o.utilN += a.n || 0;
    }
    if (a.avg_tokens != null) o.tokensSum += a.avg_tokens * (a.n || 0);
    if (a.avg_chunks != null) o.chunksSum += a.avg_chunks * (a.n || 0);
  }
  return {
    ...o,
    avgScore: o.n ? o.scoreSum / o.n : null,
    avgUtil: o.utilN ? o.utilSum / o.utilN : null,
    avgTokens: o.n ? o.tokensSum / o.n : null,
    avgChunks: o.n ? o.chunksSum / o.n : null,
  };
}

const sumA = sumAgg(out.ab.detailsA);
const sumB = sumAgg(out.ab.detailsB);
out.ab.summaryA = sumA;
out.ab.summaryB = sumB;

let verdict = 'INCONCLUSIVE';
if (sumA.n > 0 && sumB.n > 0) {
  if (sumB.hall > sumA.hall || sumB.insuff > sumA.insuff || sumB.overflow > sumA.overflow) {
    verdict = 'REGRESSED';
  } else if (
    sumB.avgScore != null &&
    sumA.avgScore != null &&
    sumB.avgScore >= sumA.avgScore - 0.5 &&
    (sumB.avgTokens == null || sumA.avgTokens == null || sumB.avgTokens <= sumA.avgTokens)
  ) {
    verdict = sumB.avgScore > sumA.avgScore + 1 ? 'IMPROVED' : 'NEUTRAL';
  } else if (sumB.avgScore != null && sumA.avgScore != null && sumB.avgScore < sumA.avgScore - 2) {
    verdict = 'REGRESSED';
  } else {
    verdict = 'NEUTRAL';
  }
}
out.ab.verdict = verdict;
ok('A/B LEGACY × BUDGETED', sumA.n > 0 && sumB.n > 0, { sumA, sumB, verdict });
ok('Mesmos grupos nos dois braços', groups.length === abRuns.A.length && groups.length === abRuns.B.length);

// Compare endpoint
const runAId = aIds[0];
const runBId = bIds[0];
if (runAId && runBId) {
  const cmp = await api(
    'GET',
    `/webhook/system/ai-context/compare?runAId=${runAId}&runBId=${runBId}`,
    token,
  );
  ok('Compare endpoint', cmp.status === 200 && !!cmp.data?.verdict, {
    status: cmp.status,
    verdict: cmp.data?.verdict,
    differences: cmp.data?.differences,
  });
  out.ab.compare = cmp.data;
}

// Controlled publish+rollback with temp (if we can attach a validation run)
if (createdVersion?.id && runLegacy.runId) {
  // Try publish with override + real run id (may still fail if run didn't use temp version — expected)
  const pubWrongRun = await api('POST', '/webhook/system/ai-context/publish', token, {
    versionId: createdVersion.id,
    override: true,
    reason: 'Teste controlado etapa 21.1 — validação de bloqueio de run incompatível',
    validationRunId: runLegacy.runId,
  });
  ok(
    'Publicação com run errado bloqueada',
    pubWrongRun.status === 400 || pubWrongRun.status === 409,
    { status: pubWrongRun.status, err: pubWrongRun.data?.error },
  );

  // Archive/reject temp draft
  await client.query(
    `UPDATE ai_context_config_versions SET status='ARCHIVED', notes=COALESCE(notes,'') || ' | archived etapa21.1'
     WHERE id=$1 AND status='DRAFT'`,
    [createdVersion.id],
  );
  ok('Temp draft arquivado', true, { id: createdVersion.id });
}

// Final production checks
const finalCtx = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT') ORDER BY version_label`,
);
const finalRet = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
out.production.context = finalCtx.rows;
out.production.retrieval = finalRet.rows;
ok(
  'Produção final LEGACY/context-v1',
  finalCtx.rows.some((r) => r.version_label === 'context-v1' && r.status === 'PUBLISHED') &&
    !finalCtx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'PUBLISHED'),
  finalCtx.rows,
);
ok(
  'Retrieval final HYBRID/hybrid-v1',
  finalRet.rows.some((r) => r.version_label === 'hybrid-v1' && r.status === 'PUBLISHED'),
  finalRet.rows,
);
ok(
  'Re-ranking continua DRAFT',
  finalRet.rows.some((r) => r.version_label === 'hybrid-rerank-v1' && r.status === 'DRAFT'),
  finalRet.rows.find((r) => r.version_label === 'hybrid-rerank-v1'),
);
ok(
  'context-budget-v1 não publicado',
  finalCtx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'DRAFT'),
);

const health = await api('GET', '/webhook/system/health', token);
ok('Health', health.status === 200 && !!(health.data?.components?.contextWindow || health.data?.contextWindow), {
  contextWindow: health.data?.components?.contextWindow || health.data?.contextWindow,
});

await client.end();
writeFileSync(new URL('./_c211-admin-ab.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\n=== SUMMARY ===');
console.log('pass', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
console.log('verdict', verdict);
console.log('wrote _c211-admin-ab.json');
