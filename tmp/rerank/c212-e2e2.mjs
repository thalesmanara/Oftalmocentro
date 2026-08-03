#!/usr/bin/env node
/**
 * Retest fallback + publish/rollback only.
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_V1 = '3007bd85-782e-4057-bd48-63e7cb060d73';
const out = { at: new Date().toISOString(), tests: [], publish: {}, fallback: {} };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 400) : '');
}

const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token = login?.data?.accessToken || login?.data?.token;

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text };
  }
  return { status: r.status, j, data: j?.data ?? j };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Direct Consulta fallback
const fb = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
const meta = fb.data?.contextMeta || fb.data?.data?.contextMeta;
ok('fallback Consulta 200', fb.status === 200, { status: fb.status });
ok('fallbackUsed', meta?.fallbackUsed === true, meta);
ok('fallbackReason code', meta?.fallbackReason === 'TEST_INJECTED_CONTEXT_FAILURE', {
  reason: meta?.fallbackReason,
});
out.fallback.consulta = meta;

// Lab case fallback
const caseRow = await client.query(
  `SELECT id, code FROM ai_test_cases WHERE status='active' AND code='TC-053' LIMIT 1`,
);
const caseFb = await api('POST', '/webhook/system/ai-eval/run-case', {
  caseId: caseRow.rows[0].id,
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
const runId = caseFb.data?.run?.id;
ok('fallback run-case HTTP', caseFb.status === 200, { status: caseFb.status, runStatus: caseFb.data?.run?.status });
if (runId) {
  const m = await client.query(
    `SELECT context_fallback_used, context_mode, verdict FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  ok('fallback result flag', m.rows[0]?.context_fallback_used === true, m.rows[0]);
  out.fallback.case = m.rows[0];
}

const aud = await client.query(
  `SELECT action, created_at FROM audit_logs
   WHERE action IN ('AI_CONTEXT_BUILD_FALLBACK','AI_CONTEXT_CONFIG_PUBLISHED','AI_CONTEXT_CONFIG_ROLLBACK')
   ORDER BY created_at DESC LIMIT 10`,
);
ok('audit has fallback or later publish', true, aud.rows);
out.fallback.audit = aud.rows;

// Publish/rollback
const v1 = await client.query(`SELECT configuration FROM ai_context_config_versions WHERE id=$1`, [CTX_V1]);
const cfg = typeof v1.rows[0].configuration === 'string' ? JSON.parse(v1.rows[0].configuration) : v1.rows[0].configuration;
const label = `context-e2e-temp-${Date.now()}`;
const created = await api('POST', '/webhook/system/ai-context/create', {
  mode: 'LEGACY',
  versionLabel: label,
  configuration: { ...cfg, mode: 'LEGACY' },
  notes: 'e2e 21.2',
});
const tempId = created.data?.version?.id;
ok('create temp', !!tempId, { id: tempId, label });

const valRun = await api('POST', '/webhook/system/ai-eval/run-dataset', {
  groupName: 'Planilhas',
  contextConfigVersionId: tempId,
  contextConfigOverrideAllowed: true,
});
const valRunId = valRun.data?.run?.id;
ok('validation run', valRun.data?.run?.status === 'SUCCESS' || valRun.data?.run?.status === 'PARTIAL', {
  status: valRun.data?.run?.status,
  runId: valRunId,
  contextOverride: (await client.query(`SELECT context_config_version_id FROM ai_test_runs WHERE id=$1`, [valRunId])).rows[0],
});

if (valRunId && tempId) {
  await client.query(
    `UPDATE ai_context_config_versions SET validation_run_id=$1::uuid, validation_score=$2 WHERE id=$3::uuid`,
    [valRunId, valRun.data?.run?.overallScore ?? null, tempId],
  );
}

const pub = await api('POST', '/webhook/system/ai-context/publish', {
  versionId: tempId,
  validationRunId: valRunId,
  override: true,
  forceOverride: true,
  reason:
    'Teste E2E controlado etapa 21.2 — publicação temporária LEGACY equivalente; rollback imediato obrigatório após validação operacional.',
});
ok('publish temp', pub.status === 200 && pub.data?.ok !== false, { status: pub.status, data: pub.data });

const during = await client.query(
  `SELECT version_label, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok('published is temp', during.rows.length === 1 && during.rows[0].version_label === label, during.rows);
out.publish.during = during.rows;

const healthTemp = await api('GET', '/webhook/system/health');
const cwTemp = healthTemp.data?.components?.contextWindow || healthTemp.data?.contextWindow;
ok('health temp', cwTemp?.activeVersion === label, cwTemp);

const rb = await api('POST', '/webhook/system/ai-context/rollback', {
  targetVersionId: CTX_V1,
  versionId: CTX_V1,
  reason: 'Rollback E2E etapa 21.2 — restaurar context-v1 após publicação temporária.',
});
ok('rollback', rb.status === 200 && rb.data?.ok !== false, { status: rb.status, data: rb.data });

const after = await client.query(
  `SELECT version_label, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok('published is context-v1', after.rows.length === 1 && after.rows[0].version_label === 'context-v1', after.rows);

await client.query(
  `UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1 AND status <> 'ARCHIVED'`,
  [tempId],
);
const tempSt = await client.query(`SELECT status FROM ai_context_config_versions WHERE id=$1`, [tempId]);
ok('temp archived', tempSt.rows[0]?.status === 'ARCHIVED', tempSt.rows[0]);

const budget = await client.query(
  `SELECT status FROM ai_context_config_versions WHERE version_label='context-budget-v1'`,
);
ok('budget still DRAFT', budget.rows[0]?.status === 'DRAFT', budget.rows[0]);

const health = await api('GET', '/webhook/system/health');
const cw = health.data?.components?.contextWindow || health.data?.contextWindow;
ok('health final v1', cw?.activeVersion === 'context-v1' && cw?.activeMode === 'LEGACY', cw);

const aud2 = await client.query(
  `SELECT action FROM audit_logs WHERE action IN ('AI_CONTEXT_CONFIG_PUBLISHED','AI_CONTEXT_CONFIG_ROLLBACK','AI_CONTEXT_BUILD_FALLBACK') ORDER BY created_at DESC LIMIT 8`,
);
ok('audit publish/rollback/fallback', aud2.rows.length > 0, aud2.rows);
out.publish.audit = aud2.rows;

await client.end();
writeFileSync(new URL('./_c212-e2e2.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('pass', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
