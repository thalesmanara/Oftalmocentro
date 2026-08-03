#!/usr/bin/env node
/**
 * Etapa 21.2 — E2E: status finalizer + fallback + publish/rollback temp.
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_V1 = '3007bd85-782e-4057-bd48-63e7cb060d73';

const out = {
  at: new Date().toISOString(),
  tests: [],
  fallback: {},
  publish: {},
  production: {},
};
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 350) : '');
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
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text };
  }
  return { status: r.status, j, data: j?.data ?? j, textLen: text.length };
}

const token = await login();
ok('login', !!token);

const noAuth = await fetch(`${BASE}/webhook/system/ai-context`);
ok('401', noAuth.status === 401 || noAuth.status === 403, { status: noAuth.status });

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Baseline
const baseline = await client.query(
  `SELECT id, version_label, mode, status, content_hash FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok('baseline context-v1', baseline.rows.length === 1 && baseline.rows[0].version_label === 'context-v1', baseline.rows);
out.production.baseline = baseline.rows;

// --- Status tests ---
async function runGroup(groupName, extra = {}) {
  return api('POST', '/webhook/system/ai-eval/run-dataset', token, {
    groupName,
    ...extra,
  });
}

console.log('Status: Planilhas (expect SUCCESS if all PASS)...');
const plan = await runGroup('Planilhas');
ok('run Planilhas HTTP', plan.status === 200, { status: plan.status, runStatus: plan.data?.run?.status });
ok(
  'run 100% PASS → SUCCESS',
  plan.data?.run?.status === 'SUCCESS' && (plan.data?.run?.failedCount || 0) === 0,
  { status: plan.data?.run?.status, passed: plan.data?.run?.passedCount, failed: plan.data?.run?.failedCount, total: plan.data?.run?.totalCases },
);

console.log('Status: Financeiro (likely PARTIAL)...');
const fin = await runGroup('Financeiro');
const finStatus = fin.data?.run?.status;
const finFailed = Number(fin.data?.run?.failedCount || 0);
ok(
  'run com FAIL funcional → PARTIAL (ou SUCCESS se 0 fail)',
  finStatus === 'PARTIAL' || (finStatus === 'SUCCESS' && finFailed === 0),
  { status: finStatus, passed: fin.data?.run?.passedCount, failed: finFailed },
);
ok('run válido não é FAILED técnico', finStatus !== 'FAILED' || Number(fin.data?.run?.totalCases || 0) === 0, {
  status: finStatus,
  total: fin.data?.run?.totalCases,
});

// repaired historical
const stillBad = await client.query(`
  SELECT COUNT(*)::int AS n FROM ai_test_runs r
  WHERE r.status='FAILED'
    AND EXISTS (SELECT 1 FROM ai_test_results x WHERE x.run_id=r.id AND x.verdict='PASS')
    AND COALESCE(r.error_count,0)=0
    AND r.started_at > NOW() - INTERVAL '14 days'
`);
ok('histórico inconsistente corrigido', stillBad.rows[0].n === 0, stillBad.rows[0]);

// --- Fallback controlled ---
async function runCaseForce(codeOrGroup) {
  const c = await client.query(
    `SELECT id, code, group_name FROM ai_test_cases WHERE status='active' AND (code=$1 OR group_name=$1) ORDER BY code LIMIT 1`,
    [codeOrGroup],
  );
  const caseRow = c.rows[0];
  if (!caseRow) return { missing: true, codeOrGroup };
  const r = await api('POST', '/webhook/system/ai-eval/run-case', token, {
    caseId: caseRow.id,
    contextConfigVersionId: CTX_V1,
    contextConfigOverrideAllowed: true,
    forceContextFailureForTest: true,
  });
  return { caseCode: caseRow.code, group: caseRow.group_name, ...r };
}

const fbCases = ['TC-053', 'Casos negativos'];
const ocr = await client.query(
  `SELECT id, code FROM ai_test_cases WHERE status='active' AND group_name='OCR' LIMIT 1`,
);
if (ocr.rows[0]) fbCases.push(ocr.rows[0].code);

out.fallback.runs = [];
for (const key of fbCases) {
  console.log('Fallback case', key);
  const r = await runCaseForce(key);
  out.fallback.runs.push({
    key,
    caseCode: r.caseCode,
    status: r.status,
    runStatus: r.data?.run?.status,
    runId: r.data?.run?.id,
  });
  if (r.runId || r.data?.run?.id) {
    const mid = r.data?.run?.id;
    const m = await client.query(
      `SELECT context_fallback_used, context_mode, verdict, score FROM ai_test_results WHERE run_id=$1`,
      [mid],
    );
    out.fallback.runs[out.fallback.runs.length - 1].metrics = m.rows[0];
    ok(`fallback ${r.caseCode || key} HTTP`, r.status === 200, { status: r.status });
    ok(
      `fallback ${r.caseCode || key} context_fallback_used`,
      m.rows[0]?.context_fallback_used === true,
      m.rows[0],
    );
  } else {
    ok(`fallback ${key} executado`, false, r);
  }
}

// Direct Consulta fallback (lab)
const consultaFb = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Quem aparece na relação de funcionários em Excel?',
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
ok('fallback Consulta API 200', consultaFb.status === 200, { status: consultaFb.status });
const ctxMeta = consultaFb.data?.contextMeta || consultaFb.data?.data?.contextMeta;
ok(
  'fallback Consulta contextMeta.fallbackUsed',
  ctxMeta?.fallbackUsed === true || ctxMeta?.contextFallbackUsed === true,
  ctxMeta,
);
ok(
  'fallback reason sanitizado',
  !ctxMeta ||
    !String(ctxMeta.fallbackReason || '').includes('at ') &&
      !String(ctxMeta.fallbackReason || '').includes('stack'),
  { reason: ctxMeta?.fallbackReason },
);
out.fallback.consulta = { status: consultaFb.status, contextMeta: ctxMeta };

// Public without force should ignore
const consultaPublic = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Quem aparece na relação de funcionários em Excel?',
  forceContextFailureForTest: true, // no overrideAllowed → should ignore
});
const pubMeta = consultaPublic.data?.contextMeta || consultaPublic.data?.data?.contextMeta;
ok(
  'force ignorado sem override lab',
  consultaPublic.status === 200 && pubMeta?.fallbackUsed !== true,
  pubMeta,
);

// Audit fallback
const aud = await client.query(
  `SELECT action, created_at FROM audit_logs
   WHERE action ILIKE '%CONTEXT%FALLBACK%' OR action = 'AI_CONTEXT_BUILD_FALLBACK'
   ORDER BY created_at DESC LIMIT 5`,
);
ok('auditoria fallback', aud.rows.length > 0, aud.rows);
out.fallback.audit = aud.rows;

// Health fallback count
const health = await api('GET', '/webhook/system/health', token);
const cw = health.data?.components?.contextWindow || health.data?.contextWindow;
ok('health up', health.status === 200 && cw?.status === 'up', cw);
out.fallback.health = cw;

// --- Publish + rollback E2E with LEGACY temp ---
const label = `context-e2e-temp-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
const v1 = await client.query(
  `SELECT mode, configuration, content_hash FROM ai_context_config_versions WHERE id=$1`,
  [CTX_V1],
);
const cfg = typeof v1.rows[0].configuration === 'string'
  ? JSON.parse(v1.rows[0].configuration)
  : v1.rows[0].configuration;

const created = await api('POST', '/webhook/system/ai-context/create', token, {
  mode: 'LEGACY',
  versionLabel: label,
  configuration: { ...cfg, mode: 'LEGACY', notes: 'e2e temp etapa21.2' },
  notes: 'publish/rollback E2E etapa 21.2',
});
const tempId = created.data?.version?.id;
ok('criar config temp', created.status === 201 || created.status === 200, {
  status: created.status,
  id: tempId,
  label,
});
out.publish.tempId = tempId;
out.publish.label = label;

if (tempId) {
  const val = await api('POST', '/webhook/system/ai-context/validate', token, {
    versionId: tempId,
    mode: 'LEGACY',
    configuration: { ...cfg, mode: 'LEGACY' },
  });
  ok('validar config temp', val.status === 200 && val.data?.ok !== false, { status: val.status });

  const valRun = await api('POST', '/webhook/system/ai-eval/run-dataset', token, {
    groupName: 'Planilhas',
    contextConfigVersionId: tempId,
    contextConfigOverrideAllowed: true,
  });
  const valRunId = valRun.data?.run?.id;
  const valRunStatus = valRun.data?.run?.status;
  ok(
    'run validação temp',
    valRun.status === 200 && (valRunStatus === 'SUCCESS' || valRunStatus === 'PARTIAL'),
    { runId: valRunId, status: valRunStatus },
  );
  out.publish.validationRunId = valRunId;

  // Attach validationRunId on version
  if (valRunId) {
    await client.query(
      `UPDATE ai_context_config_versions
       SET validation_run_id=$1::uuid,
           validation_score=COALESCE($2, validation_score)
       WHERE id=$3::uuid`,
      [valRunId, valRun.data?.metrics?.overallScore ?? valRun.data?.run?.overallScore ?? null, tempId],
    );
  }

  // Confirm production still v1 before publish
  const beforePub = await client.query(
    `SELECT version_label FROM ai_context_config_versions WHERE status='PUBLISHED'`,
  );
  ok('pré-publish ainda context-v1', beforePub.rows[0]?.version_label === 'context-v1', beforePub.rows);

  const pub = await api('POST', '/webhook/system/ai-context/publish', token, {
    versionId: tempId,
    validationRunId: valRunId,
    override: true,
    reason:
      'Teste E2E controlado etapa 21.2 — publicação temporária LEGACY equivalente para validar publish/rollback; rollback imediato obrigatório.',
  });
  ok('publish temp', pub.status === 200, { status: pub.status, data: pub.data });
  out.publish.publishResponse = { status: pub.status, data: pub.data };

  const during = await client.query(
    `SELECT version_label, status FROM ai_context_config_versions WHERE status IN ('PUBLISHED','ARCHIVED') ORDER BY version_label`,
  );
  const published = during.rows.filter((r) => r.status === 'PUBLISHED');
  ok('única PUBLISHED após publish', published.length === 1 && published[0].version_label === label, during.rows);
  out.publish.during = during.rows;

  const healthTemp = await api('GET', '/webhook/system/health', token);
  const cwTemp = healthTemp.data?.components?.contextWindow || healthTemp.data?.contextWindow;
  ok('health aponta temp', cwTemp?.activeVersion === label || cwTemp?.activeVersion?.includes('e2e-temp'), cwTemp);

  // Rollback to context-v1
  const rb = await api('POST', '/webhook/system/ai-context/rollback', token, {
    versionId: CTX_V1,
    reason: 'Rollback E2E etapa 21.2 — restaurar context-v1 após teste temporário.',
  });
  ok('rollback', rb.status === 200, { status: rb.status, data: rb.data });
  out.publish.rollback = { status: rb.status, data: rb.data };

  const after = await client.query(
    `SELECT version_label, mode, status FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT','ARCHIVED','REJECTED') ORDER BY version_label`,
  );
  const pubAfter = after.rows.filter((r) => r.status === 'PUBLISHED');
  ok(
    'após rollback context-v1 PUBLISHED',
    pubAfter.length === 1 && pubAfter[0].version_label === 'context-v1',
    pubAfter,
  );
  const tempFinal = after.rows.find((r) => r.version_label === label);
  ok(
    'temp arquivada/rejeitada',
    tempFinal && ['ARCHIVED', 'REJECTED'].includes(tempFinal.status),
    tempFinal,
  );
  out.publish.after = after.rows;

  // Force archive temp if still draft somehow
  await client.query(
    `UPDATE ai_context_config_versions SET status='ARCHIVED'
     WHERE version_label=$1 AND status NOT IN ('ARCHIVED','REJECTED')`,
    [label],
  );
}

// Final production invariants
const finalCtx = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions ORDER BY version_number`,
);
const finalRet = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
out.production.finalContext = finalCtx.rows;
out.production.finalRetrieval = finalRet.rows;

ok(
  'produção final LEGACY/context-v1',
  finalCtx.rows.some((r) => r.version_label === 'context-v1' && r.status === 'PUBLISHED') &&
    !finalCtx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'PUBLISHED') &&
    finalCtx.rows.filter((r) => r.status === 'PUBLISHED').length === 1,
  finalCtx.rows.filter((r) => ['PUBLISHED', 'DRAFT'].includes(r.status)),
);
ok(
  'retrieval HYBRID',
  finalRet.rows.some((r) => r.version_label === 'hybrid-v1' && r.status === 'PUBLISHED'),
);
ok(
  'rerank DRAFT',
  finalRet.rows.some((r) => r.version_label === 'hybrid-rerank-v1' && r.status === 'DRAFT'),
);
ok(
  'budget DRAFT',
  finalCtx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'DRAFT'),
);

const healthFinal = await api('GET', '/webhook/system/health', token);
const cwFinal = healthFinal.data?.components?.contextWindow || healthFinal.data?.contextWindow;
ok(
  'health final context-v1',
  cwFinal?.activeVersion === 'context-v1' && cwFinal?.activeMode === 'LEGACY',
  cwFinal,
);
out.production.healthFinal = cwFinal;

// Cleanup orphan e2e drafts
await client.query(
  `UPDATE ai_context_config_versions SET status='ARCHIVED'
   WHERE status='DRAFT' AND version_label LIKE 'context-e2e-temp%'`,
);
await client.query(
  `UPDATE ai_context_config_versions SET status='ARCHIVED'
   WHERE status='DRAFT' AND (version_label LIKE 'ok-%' OR version_label LIKE 'probe%' OR version_label LIKE 'context-tmp%')`,
);

await client.end();
writeFileSync(new URL('./_c212-e2e.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\npass', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
