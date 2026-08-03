#!/usr/bin/env node
/** Focused publish+rollback cycle; leave production on hybrid-v1. */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
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

async function req(path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json, text: text.slice(0, 500) };
}

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const goodCfg = {
  mode: 'HYBRID',
  candidateLimit: 20,
  finalLimit: 8,
  maxChunksPerDocument: 2,
  enableNeighbors: false,
  weights: { semantic: 0.5, lexical: 0.5 },
};

const create = await req('/webhook/system/ai-retrieval/create', 'POST', {
  mode: 'HYBRID',
  versionLabel: `tmp-pubrb-${Date.now().toString(36)}`,
  configuration: goodCfg,
  notes: 'publish-rollback cycle test',
});
const versionId = create.json?.data?.version?.id;
const hybrid = await client.query(
  `SELECT id FROM ai_retrieval_config_versions WHERE version_label='hybrid-v1' LIMIT 1`,
);

const pub = await req('/webhook/system/ai-retrieval/publish', 'POST', {
  versionId,
  forceOverride: true,
  overrideReason:
    'Teste operacional controlado de publish/rollback — reverter imediatamente para hybrid-v1',
});

const mid = await client.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval_active%' ORDER BY key`,
);
const midPub = await client.query(
  `SELECT version_label,status FROM ai_retrieval_config_versions WHERE status='PUBLISHED'`,
);

const rb = await req('/webhook/system/ai-retrieval/rollback', 'POST', {
  targetVersionId: hybrid.rows[0].id,
  reason: 'Rollback imediato pós-teste operacional — restaurar hybrid-v1',
});

const fin = await client.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval_active%' ORDER BY key`,
);
const finPub = await client.query(
  `SELECT version_label,status FROM ai_retrieval_config_versions WHERE status='PUBLISHED'`,
);

await client.query(
  `UPDATE ai_retrieval_config_versions SET status='REJECTED'
   WHERE id=$1 AND status<>'PUBLISHED'`,
  [versionId],
);

const out = {
  create: { status: create.status, id: versionId },
  publish: { status: pub.status, data: pub.json?.data || pub.json, text: pub.text },
  midSecrets: mid.rows,
  midPublished: midPub.rows,
  rollback: { status: rb.status, data: rb.json?.data || rb.json, text: rb.text },
  finalSecrets: fin.rows,
  finalPublished: finPub.rows,
  ok:
    pub.status === 200 &&
    pub.json?.data?.ok !== false &&
    rb.status === 200 &&
    fin.rows.find((r) => r.key === 'retrieval_active_version')?.value === 'hybrid-v1' &&
    finPub.rows.length === 1 &&
    finPub.rows[0].version_label === 'hybrid-v1',
};
writeFileSync(new URL('./_publish-rollback.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
process.exit(out.ok ? 0 : 1);
