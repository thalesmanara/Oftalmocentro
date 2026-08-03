#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const out = { at: new Date().toISOString() };

const names = [
  'IA - GERENCIAR JANELA DE CONTEXTO',
  'IA - CARREGAR CONTEXT CONFIG',
  'IA - VALIDAR CONTEXT CONFIG',
  'Consulta IA',
  'IA - EXECUTAR TESTE',
  'IA - EXECUTAR DATASET',
  'IA - CALCULAR MÉTRICAS',
  'SYSTEM - AI CONTEXT LIST',
  'SYSTEM - AI CONTEXT DETAIL',
  'SYSTEM - AI CONTEXT CREATE',
  'SYSTEM - AI CONTEXT UPDATE',
  'SYSTEM - AI CONTEXT VALIDATE',
  'SYSTEM - AI CONTEXT PUBLISH',
  'SYSTEM - AI CONTEXT ROLLBACK',
];

const wfs = await client.query(
  `SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE name = ANY($1) ORDER BY name`,
  [names],
);
out.workflows = wfs.rows;

const versions = await client.query(
  `SELECT id, version_label, mode, status, content_hash, validation_run_id, validation_score
   FROM ai_context_config_versions ORDER BY version_number`,
);
out.contextVersions = versions.rows;

const ret = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions
   WHERE version_label IN ('hybrid-v1','hybrid-rerank-v1')`,
);
out.retrievalVersions = ret.rows;

const cols = await client.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name IN ('ai_test_results','ai_test_runs','ai_test_metrics')
     AND column_name LIKE '%context%'
   ORDER BY table_name, column_name`,
);
out.contextColumns = cols.rows;

// Wiring: EXECUTAR TESTE / DATASET / Consulta
for (const id of ['KdpEmEGHNlPICOa4', '12t0Ol6zWQJgAKPC', 'wTH2YV6pIlhzWDiY', 'qVH5qtBf8IY32uiH', '8EXk5RkFW5cxnenL']) {
  const { rows } = await client.query(`SELECT id, name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  if (!rows[0]) continue;
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const blob = JSON.stringify(nodes);
  out[`wiring_${rows[0].name}`] = {
    id,
    hasContextConfigVersionId: blob.includes('contextConfigVersionId'),
    hasContextOverride: blob.includes('contextConfigOverrideAllowed'),
    hasContextMeta: blob.includes('contextMeta'),
    nodeNames: nodes.map((n) => n.name).slice(0, 40),
  };
}

// Validate workflow code snippet
const val = await client.query(
  `SELECT nodes FROM workflow_entity WHERE name='IA - VALIDAR CONTEXT CONFIG'`,
);
const vNodes = typeof val.rows[0].nodes === 'string' ? JSON.parse(val.rows[0].nodes) : val.rows[0].nodes;
const vCode = vNodes.find((n) => n.name === 'Validar')?.parameters?.jsCode || '';
out.validateHasUnknown = vCode.includes('Campo desconhecido');
out.validateHasBoolean = vCode.includes('boolean');
out.validateLen = vCode.length;

// History drift check for key workflows
const drift = [];
for (const wf of wfs.rows) {
  if (!wf.activeVersionId) {
    drift.push({ id: wf.id, name: wf.name, issue: 'no activeVersionId' });
    continue;
  }
  const h = await client.query(
    `SELECT nodes FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
    [wf.id, wf.activeVersionId],
  );
  const e = await client.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [wf.id]);
  const en = JSON.stringify(typeof e.rows[0].nodes === 'string' ? JSON.parse(e.rows[0].nodes) : e.rows[0].nodes);
  const hn = h.rows[0]
    ? JSON.stringify(typeof h.rows[0].nodes === 'string' ? JSON.parse(h.rows[0].nodes) : h.rows[0].nodes)
    : null;
  if (!hn) drift.push({ id: wf.id, name: wf.name, issue: 'missing history' });
  else if (en !== hn) drift.push({ id: wf.id, name: wf.name, issue: 'entity!=history', entityLen: en.length, histLen: hn.length });
}
out.drift = drift;

writeFileSync(new URL('./_c211-inspect.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ workflows: out.workflows.length, versions: out.contextVersions, drift: out.drift, wiringKeys: Object.keys(out).filter(k=>k.startsWith('wiring_')) }, null, 2));
for (const k of Object.keys(out).filter((x) => x.startsWith('wiring_'))) {
  console.log(k, out[k].hasContextConfigVersionId, out[k].hasContextOverride, out[k].hasContextMeta);
}
await client.end();
