#!/usr/bin/env node
/**
 * Quick fallback verification after trigger schema fix.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_V1 = '3007bd85-782e-4057-bd48-63e7cb060d73';
const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 500) : '');
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
    j = { raw: text.slice(0, 500) };
  }
  return { status: r.status, j, data: j?.data ?? j };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Confirm trigger has force
{
  const { rows } = await client.query(`SELECT nodes, "versionId" FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const trig = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
  const names = trig.parameters.workflowInputs.values.map((v) => v.name);
  ok('CWM trigger has force', names.includes('forceContextFailureForTest'), { versionId: rows[0].versionId, names });
}

// Normal consulta
const normal = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
});
ok('normal 200', normal.status === 200, { status: normal.status, fb: normal.data?.contextMeta?.fallbackUsed });

// Forced fallback
const fb = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
const meta = fb.data?.contextMeta || fb.j?.data?.contextMeta || fb.j?.contextMeta;
ok('fallback 200', fb.status === 200, { status: fb.status });
ok('fallbackUsed', meta?.fallbackUsed === true, meta);
ok('fallbackReason', meta?.fallbackReason === 'TEST_INJECTED_CONTEXT_FAILURE', {
  reason: meta?.fallbackReason,
});
ok('no stack exposed', !JSON.stringify(fb.j || {}).includes('Error:') && !JSON.stringify(fb.j || {}).includes('at Object'), {
  sample: JSON.stringify(fb.j).slice(0, 300),
});

// Public-ish ignore without override
const ignored = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
  forceContextFailureForTest: true,
});
ok(
  'force ignored without override',
  ignored.data?.contextMeta?.fallbackUsed !== true,
  ignored.data?.contextMeta,
);

// Lab case
const caseRow = await client.query(
  `SELECT id, code FROM ai_test_cases WHERE status='active' AND code='TC-053' LIMIT 1`,
);
const caseFb = await api('POST', '/webhook/system/ai-eval/run-case', {
  caseId: caseRow.rows[0]?.id,
  contextConfigVersionId: CTX_V1,
  contextConfigOverrideAllowed: true,
  forceContextFailureForTest: true,
});
const runId = caseFb.data?.run?.id;
ok('run-case http', caseFb.status === 200, { status: caseFb.status, runStatus: caseFb.data?.run?.status });
if (runId) {
  const m = await client.query(
    `SELECT context_fallback_used, context_mode, verdict FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  ok('result context_fallback_used', m.rows[0]?.context_fallback_used === true, m.rows[0]);
}

const aud = await client.query(
  `SELECT action, created_at FROM audit_logs WHERE action='AI_CONTEXT_BUILD_FALLBACK' ORDER BY created_at DESC LIMIT 5`,
);
ok('audit fallback', aud.rows.length > 0, aud.rows);

// Health
const health = await api('GET', '/webhook/system/health');
const cw = health.data?.contextWindow || health.j?.data?.contextWindow || health.j?.contextWindow;
ok('health contextWindow version', cw?.activeVersion === 'context-v1', cw);
ok('health secretsMatch', cw?.secretsMatchPublished === true, { secretsMatchPublished: cw?.secretsMatchPublished });
ok('health multiplePublished', (cw?.multiplePublishedCount ?? 0) === 0, {
  multiplePublishedCount: cw?.multiplePublishedCount,
});
ok('health fallbackCount present', typeof cw?.fallbackCount7d === 'number', {
  fallbackCount7d: cw?.fallbackCount7d,
});

// Secrets sanity
const secrets = await client.query(
  `SELECT key, value FROM app_secrets WHERE key IN ('retrieval_active_mode','retrieval_active_version','context_active_mode','context_active_version') ORDER BY key`,
);
ok(
  'secrets correct',
  JSON.stringify(Object.fromEntries(secrets.rows.map((r) => [r.key, r.value]))) ===
    JSON.stringify({
      context_active_mode: 'LEGACY',
      context_active_version: 'context-v1',
      retrieval_active_mode: 'HYBRID',
      retrieval_active_version: 'hybrid-v1',
    }),
  secrets.rows,
);

writeFileSync(new URL('./_c212-fb-verify.json', import.meta.url), JSON.stringify(out, null, 2));
await client.end();
console.log('\nPASS', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
