#!/usr/bin/env node
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail });
  console.log(`${pass ? 'OK' : 'FAIL'} ${name}`, detail || '');
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
ok('login', !!token);

const list = await fetch(`${BASE}/webhook/system/ai-context`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json().then((j) => ({ status: r.status, j })));
ok('GET ai-context', list.status === 200 && (list.j?.data?.items?.length > 0 || list.j?.items?.length > 0), {
  status: list.status,
  items: list.j?.data?.items?.length || list.j?.items?.length,
});

const detail = await fetch(`${BASE}/webhook/system/ai-context/detail`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json().then((j) => ({ status: r.status, j })));
ok('GET ai-context/detail', detail.status === 200, {
  status: detail.status,
  active: detail.j?.data?.activeVersion?.versionLabel || detail.j?.activeVersion?.versionLabel,
  modes: (detail.j?.data?.versions || detail.j?.versions || []).map((v) => `${v.versionLabel}:${v.status}`),
});

const health = await fetch(`${BASE}/webhook/system/health`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const comps = health?.data?.components || health?.components || {};
ok('health contextWindow', !!comps.contextWindow, comps.contextWindow);

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const ret = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
const ctx = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions ORDER BY version_number`,
);
ok(
  'produção HYBRID/hybrid-v1',
  ret.rows.some((r) => r.version_label === 'hybrid-v1' && r.status === 'PUBLISHED'),
  ret.rows,
);
ok(
  'hybrid-rerank DRAFT',
  ret.rows.some((r) => r.version_label === 'hybrid-rerank-v1' && r.status === 'DRAFT'),
  ret.rows.find((r) => r.version_label === 'hybrid-rerank-v1'),
);
ok(
  'context-v1 LEGACY PUBLISHED',
  ctx.rows.some((r) => r.version_label === 'context-v1' && r.mode === 'LEGACY' && r.status === 'PUBLISHED'),
  ctx.rows,
);
ok(
  'context-budget-v1 DRAFT',
  ctx.rows.some((r) => r.version_label === 'context-budget-v1' && r.status === 'DRAFT'),
  ctx.rows.find((r) => r.version_label === 'context-budget-v1'),
);

const consulta = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const names =
  typeof consulta.rows[0].nodes === 'string'
    ? JSON.parse(consulta.rows[0].nodes).map((n) => n.name)
    : consulta.rows[0].nodes.map((n) => n.name);
ok(
  'Consulta tem CWM após prompt',
  names.includes('IA - GERENCIAR JANELA DE CONTEXTO') && names.includes('IA - RECUPERAR CONTEXTO'),
  names.filter((n) => /RECUPERAR|GERENCIAR|prompt|janela/i.test(n)),
);

await client.end();
writeFileSync(new URL('./_cwm-final-tests.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
