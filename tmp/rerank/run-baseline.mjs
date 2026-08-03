#!/usr/bin/env node
/** Etapa 20 — baseline HYBRID + smokes retrieval/rerank */
import { writeFileSync } from 'fs';

const BASE = process.env.N8N_BASE || 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = process.env.TEST_EMAIL || 'compras@oftalmocentrouberaba.com.br';
const PASSWORD = process.env.TEST_PASSWORD || '12345678';

async function req(path, { method = 'GET', token, body, timeoutMs = 300000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text?.slice(0, 500) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

const out = { startedAt: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail || '');
}

const login = await req('/webhook/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
const token = login.json?.data?.accessToken || login.json?.data?.token || '';
ok('login', !!token, `status=${login.status}`);
if (!token) {
  writeFileSync(new URL('./_baseline.json', import.meta.url), JSON.stringify(out, null, 2));
  process.exit(1);
}

const noAuth = await req('/webhook/system/ai-retrieval');
ok('401 retrieval sem token', noAuth.status === 401 || noAuth.status === 403, `status=${noAuth.status}`);

const list = await req('/webhook/system/ai-retrieval', { token });
ok(
  'GET ai-retrieval',
  list.status === 200 && Array.isArray(list.json?.data?.items || list.json?.items),
  `status=${list.status} items=${(list.json?.data?.items || list.json?.items || []).length}`,
);

const detail = await req('/webhook/system/ai-retrieval/detail', { token });
ok(
  'GET ai-retrieval/detail',
  detail.status === 200 && (detail.json?.data?.versions || detail.json?.versions),
  `status=${detail.status} versions=${(detail.json?.data?.versions || detail.json?.versions || []).length}`,
);

const health = await req('/webhook/system/health', { token });
const retrievalComp = health.json?.data?.components?.retrieval || health.json?.components?.retrieval;
ok(
  'health retrieval component',
  health.status === 200 && !!retrievalComp,
  JSON.stringify(retrievalComp || health.json?.data?.components && Object.keys(health.json.data.components)),
);

const t0 = Date.now();
const run = await req('/webhook/system/ai-eval/run-dataset', {
  method: 'POST',
  token,
  body: { groupName: 'Planilhas', includeMissingDocs: false },
  timeoutMs: 360000,
});
const durationMs = Date.now() - t0;
const runData = run.json?.data || run.json || {};
ok(
  'baseline dataset Planilhas HYBRID',
  run.status === 200 && (runData.overallScore != null || runData.run?.overallScore != null || runData.status),
  `status=${run.status} durationMs=${durationMs} score=${runData.overallScore ?? runData.run?.overallScore} mode=${runData.retrievalMode ?? runData.run?.retrievalMode} version=${runData.retrievalConfigVersion ?? runData.run?.retrievalConfigVersion}`,
);
out.baseline = { status: run.status, durationMs, data: runData };

// Consulta IA smoke — contract
const consulta = await req('/webhook/consulta-ia', {
  method: 'POST',
  token,
  body: { question: 'Qual o código do procedimento OCT?' },
  timeoutMs: 120000,
});
const cdata = consulta.json?.data || consulta.json || {};
const hasChunks = JSON.stringify(cdata).includes('chunkText') || JSON.stringify(cdata).includes('embedding');
ok(
  'Consulta IA contrato',
  consulta.status === 200 && !hasChunks,
  `status=${consulta.status} hasAnswer=${!!(cdata.answer || cdata.response)} sources=${(cdata.sources || []).length}`,
);

// validate endpoint
const validate = await req('/webhook/system/ai-retrieval/validate', {
  method: 'POST',
  token,
  body: { mode: 'HYBRID_RERANK', configuration: { candidateLimit: 30, finalLimit: 8, weights: { semantic: 0.45, lexical: 0.25, hybridPrior: 0.15 } } },
});
ok('validate retrieval', validate.status === 200 || validate.json?.data?.ok === true || validate.json?.ok === true, `status=${validate.status}`);

const bad = await req('/webhook/system/ai-retrieval/validate', {
  method: 'POST',
  token,
  body: { mode: 'NOPE', configuration: { candidateLimit: 999 } },
});
ok('validate rejects bad', bad.status === 400 || bad.json?.ok === false || (bad.json?.data?.errors || []).length > 0, `status=${bad.status}`);

out.finishedAt = new Date().toISOString();
writeFileSync(new URL('./_baseline.json', import.meta.url), JSON.stringify(out, null, 2));
const failed = out.tests.filter((t) => !t.pass).length;
console.log(`DONE failed=${failed}/${out.tests.length}`);
process.exit(failed ? 1 : 0);
