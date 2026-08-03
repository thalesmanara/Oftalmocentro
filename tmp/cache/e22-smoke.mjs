#!/usr/bin/env node
/**
 * Etapa 22 smoke tests — SHADOW never serves cache; admin + production state.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import {
  normalizeQuestion,
  buildScopeHash,
  buildCacheKeyHash,
  detectSensitive,
  validateCacheConfiguration,
  defaultCacheConfig,
} from './cache-helpers.mjs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail != null ? JSON.stringify(detail).slice(0, 350) : '');
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
    j = { raw: text.slice(0, 300) };
  }
  return { status: r.status, j, data: j?.data ?? j };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Unit helpers
ok('normalize exact/normalized', normalizeQuestion('Qual o CPF da Bianca?') === normalizeQuestion('qual é o cpf da bianca') || normalizeQuestion('  CPF Bianca!! ') === 'cpf bianca', {
  a: normalizeQuestion('Qual o CPF da Bianca?'),
  b: normalizeQuestion('qual é o cpf da bianca'),
  c: normalizeQuestion('  CPF Bianca!! '),
});
ok('sensitive CPF', detectSensitive('Qual o CPF 123.456.789-09 da Bianca?') === true);
ok('validate ok', validateCacheConfiguration(defaultCacheConfig()).ok === true);
ok('validate bad mode', validateCacheConfiguration({ ...defaultCacheConfig(), mode: 'FOO' }).ok === false);
ok('validate ttl string', validateCacheConfiguration({ ...defaultCacheConfig(), ttlSeconds: '86400' }).ok === false);
ok('validate conflict true', validateCacheConfiguration({ ...defaultCacheConfig(), cacheConflictResponses: true }).ok === false);
ok(
  'scope hash stable',
  buildScopeHash({ isMaster: false, permissions: ['b', 'a'] }) ===
    buildScopeHash({ isMaster: false, permissions: ['a', 'b'] }),
);

const noAuth = await fetch(`${BASE}/webhook/system/ai-cache`, { method: 'GET' });
const noAuthJ = await noAuth.json().catch(() => ({}));
ok(
  '401 list',
  noAuth.status === 401 ||
    noAuthJ?.statusCode === 401 ||
    noAuthJ?.response?.success === false ||
    noAuthJ?.success === false,
  { status: noAuth.status, code: noAuthJ?.statusCode || noAuthJ?.response?.error?.code },
);

const list = await api('GET', '/webhook/system/ai-cache');
const listItem = list.data?.items?.[0] || list.data?.response?.data?.items?.[0] || list.j?.response?.data?.items?.[0];
ok('list 200', list.status === 200, { status: list.status });
ok('list SHADOW', listItem?.activeMode === 'SHADOW' || listItem?.publishedVersion?.mode === 'SHADOW', listItem);

const detail = await api('GET', '/webhook/system/ai-cache/detail');
ok('detail 200', detail.status === 200, { status: detail.status });

const badVal = await api('POST', '/webhook/system/ai-cache/validate', {
  mode: 'SHADOW',
  configuration: { ...defaultCacheConfig(), ttlSeconds: -1 },
});
ok('validate rejects bad ttl', badVal.status === 400 || badVal.j?.success === false || badVal.j?.response?.success === false || badVal.statusCode === 400, {
  status: badVal.status,
});

const goodVal = await api('POST', '/webhook/system/ai-cache/validate', {
  mode: 'SHADOW',
  configuration: defaultCacheConfig(),
});
const goodOk =
  goodVal.data?.ok === true ||
  goodVal.j?.data?.ok === true ||
  goodVal.j?.response?.data?.ok === true ||
  goodVal.data?.response?.data?.ok === true;
ok('validate ok http', goodVal.status === 200 && goodOk, { status: goodVal.status, goodOk });

// Consulta SHADOW — must not serve from cache
const q1 = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
});
const meta1 = q1.data?.cacheMeta;
ok('consulta 200', q1.status === 200, { status: q1.status });
ok('shadow not answerFromCache', meta1?.answerFromCache !== true, meta1);
ok('shadow mode', !meta1 || meta1.mode === 'SHADOW' || meta1.missReason === 'SHADOW_MODE' || meta1.lookupPerformed === true || meta1.fallbackUsed === true, meta1);

const q2 = await api('POST', '/webhook/consulta-ia', {
  question: 'Quem aparece na relação de funcionários em Excel?',
});
const meta2 = q2.data?.cacheMeta;
ok('repeat still not served', meta2?.answerFromCache !== true, meta2);

const health = await api('GET', '/webhook/system/health');
const sc = health.data?.components?.semanticCache || health.j?.components?.semanticCache;
ok('health semanticCache', sc?.activeVersion === 'cache-shadow-v1' || sc?.activeMode === 'SHADOW', sc);

const secrets = await client.query(
  `SELECT key,value FROM app_secrets WHERE key IN ('cache_active_mode','cache_active_version','retrieval_active_mode','retrieval_active_version','context_active_mode','context_active_version') ORDER BY 1`,
);
ok(
  'production secrets',
  JSON.stringify(Object.fromEntries(secrets.rows.map((r) => [r.key, r.value]))) ===
    JSON.stringify({
      cache_active_mode: 'SHADOW',
      cache_active_version: 'cache-shadow-v1',
      context_active_mode: 'LEGACY',
      context_active_version: 'context-v1',
      retrieval_active_mode: 'HYBRID',
      retrieval_active_version: 'hybrid-v1',
    }),
  secrets.rows,
);

const versions = await client.query(
  `SELECT version_label, status, mode FROM ai_cache_config_versions WHERE status='PUBLISHED'`,
);
ok('unique published shadow', versions.rows.length === 1 && versions.rows[0].version_label === 'cache-shadow-v1', versions.rows);

const cleanup = await api('POST', '/webhook/system/ai-cache/cleanup', {});
ok('cleanup', cleanup.status === 200, { status: cleanup.status, data: cleanup.data });

writeFileSync(new URL('./_e22-smoke.json', import.meta.url), JSON.stringify(out, null, 2));
await client.end();
console.log('\nPASS', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
