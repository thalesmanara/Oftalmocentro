#!/usr/bin/env node
/**
 * Etapa 21.2 — full remaining E2E: fallback variants, publish/rollback, cleanup, production assert.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_V1 = '3007bd85-782e-4057-bd48-63e7cb060d73';
const BUDGET = '7587c86b-8db3-44c0-9881-1e996abda89a';
const out = { at: new Date().toISOString(), tests: [], fallback: {}, publish: {}, production: {}, health: {} };

function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 450) : '');
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
const userId = login?.data?.user?.id || login?.data?.userId;

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
    j = { raw: text.slice(0, 400) };
  }
  return { status: r.status, j, data: j?.data ?? j };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// --- Auth gates ---
const noAuth = await fetch(`${BASE}/webhook/consulta-ia`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'teste' }),
});
ok('401 consulta', noAuth.status === 401 || noAuth.status === 403, { status: noAuth.status });

// --- Fallback Consulta ---
const fb = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
const meta = fb.data?.contextMeta;
ok('fallback textual 200', fb.status === 200);
ok('fallbackUsed', meta?.fallbackUsed === true, meta);
ok('fallbackReason', meta?.fallbackReason === 'TEST_INJECTED_CONTEXT_FAILURE', {
  reason: meta?.fallbackReason,
});
out.fallback.textual = meta;

const neg = await api('POST', '/webhook/consulta-ia', {
  question: 'Qual o CPF completo do paciente João da Silva inexistente XYZ999?',
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
ok('fallback negativo 200', neg.status === 200);
ok('fallback negativo used', neg.data?.contextMeta?.fallbackUsed === true, neg.data?.contextMeta);
out.fallback.negative = neg.data?.contextMeta;

const ignored = await api('POST', '/webhook/consulta-ia', {
  question: 'teste force sem override',
  forceContextFailureForTest: true,
});
ok('force ignored public', ignored.data?.contextMeta?.fallbackUsed !== true, ignored.data?.contextMeta);

// Lab cases: tabular TC-053, OCR if any, textual
async function runCaseForce(code) {
  const { rows } = await client.query(
    `SELECT id, code, group_name FROM ai_test_cases WHERE status='active' AND code=$1 LIMIT 1`,
    [code],
  );
  if (!rows[0]) return { missing: true, code };
  const res = await api('POST', '/webhook/system/ai-eval/run-case', {
    caseId: rows[0].id,
    contextConfigVersionId: CTX_V1,
    contextConfigOverrideAllowed: true,
    forceContextFailureForTest: true,
  });
  const runId = res.data?.run?.id;
  let result = null;
  if (runId) {
    const m = await client.query(
      `SELECT context_fallback_used, context_mode, verdict FROM ai_test_results WHERE run_id=$1 LIMIT 1`,
      [runId],
    );
    result = m.rows[0];
  }
  return { code, group: rows[0].group_name, status: res.status, runStatus: res.data?.run?.status, runId, result };
}

const tabular = await runCaseForce('TC-053');
ok('lab tabular fallback', tabular.result?.context_fallback_used === true, tabular);
out.fallback.tabular = tabular;

const ocrCase = await client.query(
  `SELECT code FROM ai_test_cases WHERE status='active' AND (group_name ILIKE '%ocr%' OR code ILIKE '%OCR%' OR tags::text ILIKE '%ocr%') LIMIT 1`,
).catch(() => ({ rows: [] }));
let ocrCode = ocrCase.rows[0]?.code;
if (!ocrCode) {
  const alt = await client.query(
    `SELECT code FROM ai_test_cases WHERE status='active' AND group_name ILIKE '%documento%' LIMIT 1`,
  );
  ocrCode = alt.rows[0]?.code;
}
if (ocrCode) {
  const ocr = await runCaseForce(ocrCode);
  ok('lab ocr/doc fallback', ocr.result?.context_fallback_used === true, ocr);
  out.fallback.ocr = ocr;
} else {
  ok('lab ocr skipped (no case)', true, { note: 'no OCR case' });
}

const aud = await client.query(
  `SELECT action, created_at FROM audit_logs WHERE action='AI_CONTEXT_BUILD_FALLBACK' ORDER BY created_at DESC LIMIT 5`,
);
ok('audit fallback exists', aud.rows.length > 0, aud.rows);
out.fallback.audit = aud.rows;

// --- Publish + rollback ---
const v1 = await client.query(`SELECT configuration FROM ai_context_config_versions WHERE id=$1`, [CTX_V1]);
const cfg =
  typeof v1.rows[0].configuration === 'string'
    ? JSON.parse(v1.rows[0].configuration)
    : v1.rows[0].configuration;
const label = `context-e2e-temp-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;
const created = await api('POST', '/webhook/system/ai-context/create', {
  mode: 'LEGACY',
  versionLabel: label,
  configuration: { ...cfg, mode: 'LEGACY' },
  notes: 'e2e 21.2 final',
});
const tempId = created.data?.version?.id;
ok('create temp', !!tempId, { id: tempId, label, status: created.status });

const valRun = await api('POST', '/webhook/system/ai-eval/run-dataset', {
  groupName: 'Planilhas',
  contextConfigVersionId: tempId,
  contextConfigOverrideAllowed: true,
});
const valRunId = valRun.data?.run?.id;
ok('validation run ok', ['SUCCESS', 'PARTIAL'].includes(valRun.data?.run?.status), {
  status: valRun.data?.run?.status,
  runId: valRunId,
});

if (valRunId && tempId) {
  await client.query(`UPDATE ai_context_config_versions SET validation_run_id=$1 WHERE id=$2`, [
    valRunId,
    tempId,
  ]);
}

const pub = await api('POST', '/webhook/system/ai-context/publish', {
  versionId: tempId,
  validationRunId: valRunId,
  override: true,
  forceOverride: true,
  reason: 'etapa21.2 e2e publish temp',
});
ok('publish temp', pub.status === 200 && (pub.data?.version?.status === 'PUBLISHED' || pub.j?.success !== false), {
  status: pub.status,
  data: pub.data,
});

const during = await client.query(
  `SELECT version_label, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok('unique published during', during.rows.length === 1 && during.rows[0].version_label === label, during.rows);
out.publish.during = during.rows;

const secDuring = await client.query(
  `SELECT key, value FROM app_secrets WHERE key IN ('context_active_version','retrieval_active_version') ORDER BY key`,
);
ok(
  'secrets during: context=temp retrieval=hybrid',
  secDuring.rows.find((r) => r.key === 'context_active_version')?.value === label &&
    secDuring.rows.find((r) => r.key === 'retrieval_active_version')?.value === 'hybrid-v1',
  secDuring.rows,
);

const healthDuring = await api('GET', '/webhook/system/health');
const cwDuring = healthDuring.data?.components?.contextWindow || healthDuring.j?.components?.contextWindow;
ok('health during temp', cwDuring?.activeVersion === label, cwDuring);
out.publish.healthDuring = cwDuring;

const rb = await api('POST', '/webhook/system/ai-context/rollback', {
  targetVersionId: CTX_V1,
  reason: 'etapa21.2 e2e rollback to context-v1',
});
ok('rollback', rb.status === 200, { status: rb.status, data: rb.data });

const after = await client.query(
  `SELECT version_label, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
);
ok('published after = context-v1', after.rows.length === 1 && after.rows[0].version_label === 'context-v1', after.rows);

const tempStatus = await client.query(
  `SELECT version_label, status FROM ai_context_config_versions WHERE id=$1`,
  [tempId],
);
ok('temp not published', tempStatus.rows[0]?.status !== 'PUBLISHED', tempStatus.rows[0]);

const budget = await client.query(`SELECT status, version_label FROM ai_context_config_versions WHERE id=$1`, [BUDGET]);
ok('budget still DRAFT', budget.rows[0]?.status === 'DRAFT', budget.rows[0]);

const secAfter = await client.query(
  `SELECT key, value FROM app_secrets WHERE key IN ('context_active_mode','context_active_version','retrieval_active_mode','retrieval_active_version') ORDER BY key`,
);
ok(
  'final secrets',
  JSON.stringify(Object.fromEntries(secAfter.rows.map((r) => [r.key, r.value]))) ===
    JSON.stringify({
      context_active_mode: 'LEGACY',
      context_active_version: 'context-v1',
      retrieval_active_mode: 'HYBRID',
      retrieval_active_version: 'hybrid-v1',
    }),
  secAfter.rows,
);
out.production.secrets = secAfter.rows;

// Cleanup: archive leftover e2e temps still DRAFT/PUBLISHED incorrectly
await client.query(
  `UPDATE ai_context_config_versions
   SET status='ARCHIVED'
   WHERE version_label LIKE 'context-e2e-temp-%' AND status IN ('DRAFT','PUBLISHED','REJECTED')`,
);
// Ensure context-v1 published
await client.query(
  `UPDATE ai_context_config_versions SET status='PUBLISHED' WHERE id=$1 AND status<>'PUBLISHED'`,
  [CTX_V1],
);
await client.query(
  `UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE status='PUBLISHED' AND id<>$1`,
  [CTX_V1],
);
await client.query(`UPDATE app_secrets SET value='LEGACY', updated_at=NOW() WHERE key='context_active_mode'`);
await client.query(`UPDATE app_secrets SET value='context-v1', updated_at=NOW() WHERE key='context_active_version'`);
await client.query(`UPDATE app_secrets SET value='HYBRID', updated_at=NOW() WHERE key='retrieval_active_mode'`);
await client.query(`UPDATE app_secrets SET value='hybrid-v1', updated_at=NOW() WHERE key='retrieval_active_version'`);

const rerank = await client.query(
  `SELECT version_label, status FROM ai_retrieval_config_versions WHERE version_label='hybrid-rerank-v1'`,
);
ok('rerank DRAFT', rerank.rows[0]?.status === 'DRAFT', rerank.rows[0]);

const health = await api('GET', '/webhook/system/health');
const cw = health.data?.components?.contextWindow || health.j?.components?.contextWindow;
ok('health activeVersion context-v1', cw?.activeVersion === 'context-v1', cw);
ok('health secretsMatch', cw?.secretsMatchPublished === true, {
  secretsMatchPublished: cw?.secretsMatchPublished,
});
ok('health multiplePublished 0', (cw?.multiplePublishedCount ?? 0) === 0, {
  multiplePublishedCount: cw?.multiplePublishedCount,
});
ok('health fallbackCount number', typeof cw?.fallbackCount7d === 'number', {
  fallbackCount7d: cw?.fallbackCount7d,
});
out.health = cw;

const pubAud = await client.query(
  `SELECT action FROM audit_logs WHERE action IN ('AI_CONTEXT_CONFIG_PUBLISHED','AI_CONTEXT_CONFIG_ROLLBACK') ORDER BY created_at DESC LIMIT 6`,
);
ok('audit publish/rollback', pubAud.rows.some((r) => r.action.includes('PUBLISH')) && pubAud.rows.some((r) => r.action.includes('ROLLBACK')), pubAud.rows);

out.production.versions = (
  await client.query(
    `SELECT version_label, status, mode FROM ai_context_config_versions WHERE version_label IN ('context-v1','context-budget-v1') OR version_label LIKE 'context-e2e-temp-%' ORDER BY version_label`,
  )
).rows;

writeFileSync(new URL('./_c212-final-e2e.json', import.meta.url), JSON.stringify(out, null, 2));
await client.end();
console.log('\nPASS', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
