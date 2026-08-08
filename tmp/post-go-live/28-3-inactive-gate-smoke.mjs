#!/usr/bin/env node
/**
 * Etapa 28.3 — smoke inactive document gate (deactivate → consulta-ia → reactivate)
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const OUT = new URL('./28-3-inactive-gate-result.json', import.meta.url);

async function api(method, path, token, body, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 800) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

const c = new pg.Client({ connectionString: PG });
await c.connect();

const { rows: cfgRows } = await c.query(`
  SELECT id::text, version_label, status
  FROM ai_retrieval_config_versions
  WHERE status = 'PUBLISHED'
  ORDER BY published_at DESC NULLS LAST
  LIMIT 5
`);

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
const docs = await api('GET', '/webhook/documents', token);
const list = docs.json?.data || [];

const target =
  list.find((d) => d.isActive !== false && /ESTACIONAMENTO/i.test(d.title || '')) ||
  list.find((d) => d.isActive !== false && d.processingStatus === 'processed') ||
  list[0];

const result = {
  at: new Date().toISOString(),
  target: { id: target?.id, title: target?.title },
  retrievalConfigs: cfgRows,
  tests: [],
};

async function runTest(label, questionExtra = {}) {
  const q = await api('POST', '/webhook/consulta-ia', token, {
    question: `Traga informações exclusivas do documento exatamente intitulado: ${target.title}`,
    ...questionExtra,
  });
  const sources = q.json?.data?.sources || [];
  const ids = sources.map((s) => s.documentId || s.id);
  const leaked =
    ids.includes(target.id) ||
    sources.some((s) => (s.documentTitle || s.title) === target.title);
  return {
    label,
    status: q.status,
    leaked,
    ok: !leaked,
    sourceCount: sources.length,
    sourceIds: ids.slice(0, 10),
    sourceTitles: sources.map((s) => s.documentTitle || s.title).slice(0, 5),
    pipelineMeta: q.json?.data?.pipelineMeta || q.json?.data?.meta?.pipelineMeta || null,
  };
}

await api('PUT', '/webhook/documents/update', token, {
  id: target.id,
  title: target.title,
  sectorId: target.sectorId,
  categoryId: target.categoryId,
  subcategoryId: target.subcategoryId ?? null,
  semanticDescription: target.semanticDescription ?? null,
  expirationDate: target.expirationDate ?? null,
  isActive: false,
});

result.tests.push(await runTest('HYBRID_default_inactive'));

const hybridCfg = cfgRows.find((r) => /hybrid/i.test(r.version_label || ''));
if (hybridCfg) {
  result.tests.push(
    await runTest('HYBRID_retrievalConfigVersionId_override', {
      retrievalConfigVersionId: hybridCfg.id,
    }),
  );
}

await api('PUT', '/webhook/documents/update', token, {
  id: target.id,
  title: target.title,
  sectorId: target.sectorId,
  categoryId: target.categoryId,
  subcategoryId: target.subcategoryId ?? null,
  semanticDescription: target.semanticDescription ?? null,
  expirationDate: target.expirationDate ?? null,
  isActive: true,
});

result.tests.push(await runTest('HYBRID_after_reactivate'));
result.ok = result.tests.every((t) => t.ok);
result.inactiveTestsOk = result.tests
  .filter((t) => t.label.includes('inactive') || t.label.includes('override'))
  .every((t) => t.ok);

writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await c.end();
