#!/usr/bin/env node
/**
 * Mode override smoke via Consulta IA body override fields used by lab/dataset.
 * Consulta passes retrievalConfigVersionId into RECUPERAR when modeOverrideAllowed.
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

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

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const versions = await client.query(
  `SELECT id, version_label, mode, status FROM ai_retrieval_config_versions
   WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1') OR mode IN ('TEXT_ONLY','VECTOR_ONLY')
   ORDER BY version_label`,
);
console.log('versions', versions.rows);

// Check how Consulta maps override — inspect call node inputs
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const call = nodes.find((n) => n.name === 'IA - RECUPERAR CONTEXTO');
writeFileSync(
  new URL('./_e21-consulta-call.json', import.meta.url),
  JSON.stringify(call?.parameters || {}, null, 2),
);
console.log('call inputs', call?.parameters?.workflowInputs?.value);

async function ask(body) {
  const res = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const meta = json?.data?.retrievalMeta || null;
  return {
    status: res.status,
    mode: meta?.mode,
    version: meta?.configVersion,
    selected: meta?.selectedCount,
    fallback: meta?.fallbackUsed,
    rerankMs: meta?.rerankLatencyMs,
  };
}

const q = 'Quais documentos tratam de biometria?';
const prod = await ask({ question: q });
const draftId = versions.rows.find((r) => r.version_label === 'hybrid-rerank-v1')?.id;
const override = draftId
  ? await ask({
      question: q,
      retrievalConfigVersionId: draftId,
      modeOverrideAllowed: true,
    })
  : { error: 'no draft' };

const out = { prod, override, versions: versions.rows };
writeFileSync(new URL('./_e21-mode-override.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
