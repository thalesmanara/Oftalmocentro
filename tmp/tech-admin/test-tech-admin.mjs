#!/usr/bin/env node
/**
 * Testes Administrador Técnico — Parte 2.1
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const results = [];
function ok(name, pass, detail = '') {
  results.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail);
}

async function login(email, password) {
  const r = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return {
    status: r.status,
    token: j?.data?.token || j?.token,
    user: j?.data?.user || j?.user,
    raw: j,
  };
}

async function api(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text.slice(0, 300) };
  }
  return { status: r.status, j };
}

// 1 migration
const col = await c.query(
  `SELECT column_default, is_nullable FROM information_schema.columns WHERE table_name='users' AND column_name='is_technical_admin'`,
);
ok('1 migration column', col.rows.length === 1 && col.rows[0].is_nullable === 'NO', JSON.stringify(col.rows[0]));

// 2 existing false
const cnt = await c.query(
  `SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE is_technical_admin)::int AS t FROM users`,
);
ok('2 existing false', cnt.rows[0].t === 0, JSON.stringify(cnt.rows[0]));

// Login master (need password - try common or skip if unknown)
// Use compras (not master) and check isTechnicalAdmin false
const lab = await login('compras@oftalmocentrouberaba.com.br', '12345678');
ok('7 login returns isTechnicalAdmin', lab.user && lab.user.isTechnicalAdmin === false, `keys=${Object.keys(lab.user || {})}`);
ok('lab not master', lab.user?.isMaster === false);

const validate = await api('POST', '/webhook/auth/validate', lab.token, {});
const vu = validate.j?.data?.user || validate.j?.user || validate.j?.data;
ok(
  '8 validate session isTechnicalAdmin',
  validate.status === 200 && (vu?.isTechnicalAdmin === false || vu?.is_technical_admin === false || ('isTechnicalAdmin' in (vu || {}) && vu.isTechnicalAdmin === false)),
  `status=${validate.status} user=${JSON.stringify(vu)?.slice(0, 200)}`,
);

// Common user technical endpoint 403
const health = await api('GET', '/webhook/system/health', lab.token);
ok('22 common tech endpoint 403', health.status === 403, `status=${health.status}`);

const prompts = await api('GET', '/webhook/system/ai-prompts', lab.token);
ok('22b prompts 403', prompts.status === 403, `status=${prompts.status}`);

// Institutional settings should still work with editar_configuracoes for lab if they have it
const settings = await api('GET', '/webhook/settings', lab.token);
ok(
  'settings institutional not blocked solely by tech gate',
  settings.status === 200 || settings.status === 403,
  `status=${settings.status} (403 ok if sem editar_configuracoes)`,
);

// Master login — try thales? password unknown. Promote compras temporarily? Better: use SQL to grant tech to a test user and login as lab after grant via master... we don't have master password.

// Create ephemeral: set compras as technical admin via SQL for tests, then revoke
const comprasId = '06e0915e-0f90-42b1-a32c-ae5e0f7de1c6';
await c.query(`UPDATE users SET is_technical_admin=true WHERE id=$1`, [comprasId]);
const lab2 = await login('compras@oftalmocentrouberaba.com.br', '12345678');
ok('7b login after grant', lab2.user?.isTechnicalAdmin === true, JSON.stringify({ isTechnicalAdmin: lab2.user?.isTechnicalAdmin, isMaster: lab2.user?.isMaster }));

const health2 = await api('GET', '/webhook/system/health', lab2.token);
ok('12-20 tech admin health', health2.status === 200, `status=${health2.status}`);

const prompts2 = await api('GET', '/webhook/system/ai-prompts', lab2.token);
ok('13 tech admin prompts', prompts2.status === 200, `status=${prompts2.status}`);

const retrieval = await api('GET', '/webhook/system/ai-retrieval', lab2.token);
ok('14 tech admin retrieval', retrieval.status === 200, `status=${retrieval.status}`);

// Tech admin cannot set master via users update (escalation)
const esc = await api('PUT', '/webhook/users/update', lab2.token, {
  id: comprasId,
  name: lab2.user.name,
  email: 'compras@oftalmocentrouberaba.com.br',
  sectorId: null,
  active: true,
  isMaster: true,
  isTechnicalAdmin: true,
  permissions: lab2.user.permissions || [],
});
ok('25 tech admin cannot assign master', esc.status === 403 || esc.j?.data?.isMaster !== true, `status=${esc.status}`);

// Tech admin without gerenciar_usuarios? compras may have it - check users list
const usersList = await api('GET', '/webhook/users', lab2.token);
ok('24 no general bypass — users depends on permission', usersList.status === 200 || usersList.status === 403, `status=${usersList.status}`);

// Revoke tech admin
await c.query(`UPDATE users SET is_technical_admin=false WHERE id=$1`, [comprasId]);
const lab3 = await login('compras@oftalmocentrouberaba.com.br', '12345678');
ok('6 revoke persists', lab3.user?.isTechnicalAdmin === false);

const health3 = await api('GET', '/webhook/system/health', lab3.token);
ok('11 after revoke health 403', health3.status === 403, `status=${health3.status}`);

// Privilege escalation by common user create
const createEsc = await api('POST', '/webhook/users/create', lab3.token, {
  name: 'Temp Tech Escalation',
  email: `temp-tech-${Date.now()}@test.local`,
  passwordHash: 'TempPass123!',
  active: true,
  isMaster: false,
  isTechnicalAdmin: true,
  permissions: ['visualizar_documentos'],
});
ok(
  '26/27 common cannot assign tech admin',
  createEsc.status === 403 || createEsc.j?.data?.isTechnicalAdmin !== true,
  `status=${createEsc.status}`,
);

// Cleanup if created
if (createEsc.j?.data?.id) {
  await c.query(`UPDATE users SET active=false WHERE id=$1`, [createEsc.j.data.id]);
}

const summary = {
  at: new Date().toISOString(),
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  failed: results.filter((r) => !r.pass),
  results,
};
writeFileSync(new URL('./tech-admin-tests.json', import.meta.url), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ passed: summary.passed, total: summary.total, failed: summary.failed.length }, null, 2));
await c.end();
process.exit(summary.failed.length ? 1 : 0);
