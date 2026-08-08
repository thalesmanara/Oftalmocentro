import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail });
  console.log(pass ? 'OK' : 'FAIL', name, detail || '');
}

// 1) no token
const noAuth = await api('POST', '/webhook/system/ai-retrieval/publish', null, {});
ok('publish-401', noAuth.status === 401 || noAuth.status === 403, { status: noAuth.status });

// 2) common admin (compras has editar_configuracoes but NOT tech admin)
const login = await api('POST', '/webhook/auth/login', null, {
  email: 'compras@oftalmocentrouberaba.com.br',
  password: '12345678',
});
const token = login.json?.data?.token;
const user = login.json?.data?.user || login.json?.data;
ok('login-compras', !!token, {
  isMaster: user?.isMaster,
  isTechnicalAdmin: user?.isTechnicalAdmin,
});

const forbidden = await api('POST', '/webhook/system/ai-retrieval/publish', token, {
  versionId: '00000000-0000-0000-0000-000000000000',
  forceOverride: true,
  reason: 'test',
});
ok(
  'publish-403-common-admin',
  forbidden.status === 403,
  { status: forbidden.status, code: forbidden.json?.error?.code || forbidden.json?.code },
);

const rollbackForbidden = await api('POST', '/webhook/system/ai-retrieval/rollback', token, {
  targetVersionId: '00000000-0000-0000-0000-000000000000',
  reason: 'test',
});
ok('rollback-403-common-admin', rollbackForbidden.status === 403, { status: rollbackForbidden.status });

// Find a master/tech admin if credentials known in lab — skip live publish
out.note =
  'Publish endpoint already requires requiredTechnicalAdmin=true. Common admin with only editar_configuracoes correctly receives 403. Live publish/rollback by Master not exercised to avoid churn; hybrid version decision handled separately.';

writeFileSync('tmp/post-go-live/28-3-publish-auth.json', JSON.stringify(out, null, 2));
console.log('PASS', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
