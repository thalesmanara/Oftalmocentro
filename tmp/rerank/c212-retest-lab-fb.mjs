#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const CTX_V1 = '3007bd85-782e-4057-bd48-63e7cb060d73';
const out = { tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail });
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
async function api(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  return { status: r.status, data: j?.data ?? j };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function run(code) {
  const { rows } = await client.query(
    `SELECT id, code, group_name FROM ai_test_cases WHERE status='active' AND code=$1`,
    [code],
  );
  const res = await api('/webhook/system/ai-eval/run-case', {
    caseId: rows[0].id,
    contextConfigVersionId: CTX_V1,
    contextConfigOverrideAllowed: true,
    forceContextFailureForTest: true,
  });
  const runId = res.data?.run?.id;
  const m = await client.query(
    `SELECT context_fallback_used, verdict FROM ai_test_results WHERE run_id=$1`,
    [runId],
  );
  return { code, group: rows[0].group_name, runStatus: res.data?.run?.status, result: m.rows[0], runId };
}

for (const code of ['TC-053', 'TC-011']) {
  const r = await run(code);
  ok(`${code} fallback`, r.result?.context_fallback_used === true, r);
}

writeFileSync(new URL('./_c212-lab-fb.json', import.meta.url), JSON.stringify(out, null, 2));
await client.end();
