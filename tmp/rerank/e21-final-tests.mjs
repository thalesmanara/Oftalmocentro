#!/usr/bin/env node
/**
 * Etapa 21 — mode overrides + production confirmation + backup/health smoke.
 */
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

async function consulta(question) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ms: Date.now() - t0, data: json?.data || json };
}

const c = await consulta('Quais documentos tratam de biometria e cálculo de lentes intraoculares?');
ok('consulta HYBRID produção', c.status === 200 && !!c.data?.answer, {
  mode: c.data?.retrievalMeta?.mode,
  version: c.data?.retrievalMeta?.configVersion,
  selected: c.data?.retrievalMeta?.selectedCount,
  rankedDocs: (c.data?.retrievalMeta?.rankedDocumentIds || []).length,
  rankedChunks: (c.data?.retrievalMeta?.rankedChunkIds || []).length,
  leakedChunkId: JSON.stringify(c.data?.sources || []).includes('chunkId'),
});

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const pub = await client.query(
  `SELECT id, version_label, mode, status FROM ai_retrieval_config_versions
   WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 3`,
);
ok(
  'produção HYBRID/hybrid-v1',
  pub.rows[0]?.version_label === 'hybrid-v1' && String(pub.rows[0]?.mode).toUpperCase() === 'HYBRID',
  pub.rows[0],
);

const draft = await client.query(
  `SELECT id, version_label, mode, status FROM ai_retrieval_config_versions
   WHERE version_label='hybrid-rerank-v1' LIMIT 1`,
);
ok(
  'hybrid-rerank-v1 permanece DRAFT',
  !draft.rows[0] || String(draft.rows[0].status).toUpperCase() === 'DRAFT',
  draft.rows[0],
);

const consultaNodes = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const names =
  typeof consultaNodes.rows[0].nodes === 'string'
    ? JSON.parse(consultaNodes.rows[0].nodes).map((n) => n.name)
    : consultaNodes.rows[0].nodes.map((n) => n.name);
const banned = [
  'Buscar chunks relevantes',
  'Busca vetorial Qdrant',
  'Merge híbrido',
  'Chamar RE-RANQUEAR',
  'Montar contexto',
];
ok(
  'Consulta IA sem lógica de busca',
  banned.every((b) => !names.includes(b)) && names.includes('IA - RECUPERAR CONTEXTO'),
  { nodeCount: names.length, hasRecuperar: names.includes('IA - RECUPERAR CONTEXTO') },
);

const recuperar = await client.query(
  `SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE name='IA - RECUPERAR CONTEXTO'`,
);
ok('IA - RECUPERAR CONTEXTO ativo', !!recuperar.rows[0]?.active, recuperar.rows[0]);

const qdrantHist = await client.query(
  `SELECT nodes FROM workflow_history WHERE "workflowId"='YDnrXjzYUOrZVE6N' AND "versionId"=(
     SELECT "activeVersionId" FROM workflow_entity WHERE id='YDnrXjzYUOrZVE6N'
   )`,
);
const qNames =
  typeof qdrantHist.rows[0]?.nodes === 'string'
    ? JSON.parse(qdrantHist.rows[0].nodes).map((n) => n.name)
    : (qdrantHist.rows[0]?.nodes || []).map((n) => n.name);
ok('QDRANT history sem Stub', !qNames.includes('Stub') && qNames.includes('Qdrant search'), qNames);

// health
const healthRes = await fetch(`${BASE}/webhook/system/health`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const health = await healthRes.json().catch(() => null);
const comps = health?.data?.components || health?.components || {};
ok(
  'health retrievalPipeline',
  !!(comps.retrievalPipeline || comps.retrieval),
  {
    retrievalPipeline: comps.retrievalPipeline || null,
    retrieval: comps.retrieval || null,
    qdrant: comps.qdrant?.status || comps.qdrant?.online,
  },
);

await client.end();
writeFileSync(new URL('./_e21-tests.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
