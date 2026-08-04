#!/usr/bin/env node
/**
 * Etapa 28 — inventário final (não destrutivo)
 */
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const out = {
  at: new Date().toISOString(),
  architecture: 'React → n8n → PostgreSQL → Arquivos → Tika/OCR/Tabular → Embeddings → Qdrant → OpenAI',
};

const { rows: secrets } = await c.query(`
  SELECT key, value FROM app_secrets
  WHERE key LIKE '%active%' OR key LIKE '%version%' OR key LIKE '%mode%'
  ORDER BY key`);
out.secrets = Object.fromEntries(secrets.map((r) => [r.key, r.value]));

const gov = [
  ['ai_prompt_versions', 'prompt'],
  ['ai_retrieval_config_versions', 'retrieval'],
  ['ai_context_config_versions', 'context'],
  ['ai_cache_config_versions', 'cache'],
  ['ai_evidence_config_versions', 'evidence'],
  ['ai_response_quality_config_versions', 'response_quality'],
];
out.versions = {};
for (const [table, label] of gov) {
  try {
    const { rows } = await c.query(
      `SELECT version_label, status, mode FROM ${table} ORDER BY version_number NULLS LAST, created_at`,
    );
    out.versions[label] = rows;
    const pubs = rows.filter((r) => r.status === 'PUBLISHED');
    out.versions[`${label}_published_count`] = pubs.length;
  } catch (e) {
    out.versions[label] = { error: e.message };
  }
}

const { rows: wfs } = await c.query(`
  SELECT id, name, active, "versionId", "activeVersionId",
    EXISTS (SELECT 1 FROM workflow_history h WHERE h."workflowId"=w.id AND h."versionId"=w."activeVersionId") AS hist_ok
  FROM workflow_entity w
  WHERE active=true ORDER BY name`);
out.activeWorkflows = wfs;
out.workflowHistoryIssues = wfs.filter((w) => !w.hist_ok || w.versionId !== w.activeVersionId);

// webhooks inventory
const hooks = [];
for (const w of wfs) {
  const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [w.id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    if (String(n.type || '').includes('webhook')) {
      const path = n.parameters?.path || n.parameters?.options?.path || null;
      hooks.push({ workflow: w.name, node: n.name, path, webhookId: n.webhookId || null });
    }
  }
}
out.webhooks = hooks;

// schedules
const { rows: schedules } = await c.query(`
  SELECT id, name FROM workflow_entity
  WHERE active=true AND (name ILIKE '%schedule%' OR name ILIKE '%backup%' OR nodes::text ILIKE '%scheduleTrigger%')
  ORDER BY name`);
out.schedules = schedules;

// disk-ish via table counts
const { rows: counts } = await c.query(`
  SELECT
    (SELECT COUNT(*)::int FROM documents) AS documents,
    (SELECT COUNT(*)::int FROM document_versions) AS document_versions,
    (SELECT COUNT(*)::int FROM document_chunks) AS document_chunks,
    (SELECT COUNT(*)::int FROM users) AS users,
    (SELECT COUNT(*)::int FROM audit_logs) AS audit_logs,
    (SELECT COUNT(*)::int FROM ai_test_cases) AS ai_test_cases
`);
out.counts = counts[0];

// permissions
const { rows: perms } = await c.query(`SELECT code FROM permissions ORDER BY code`);
out.permissions = perms.map((p) => p.code);

// expected production state check
const expected = {
  retrieval_active_version: 'hybrid-v1',
  retrieval_active_mode: 'HYBRID',
  context_active_version: 'context-v1',
  context_active_mode: 'LEGACY',
  cache_active_version: 'cache-shadow-v1',
  cache_active_mode: 'SHADOW',
  evidence_active_version: 'evidence-v1',
  response_quality_active_version: 'response-quality-v2',
  response_quality_active_mode: 'VALIDATE_STRICT',
};
out.expectedMatch = {};
for (const [k, v] of Object.entries(expected)) {
  out.expectedMatch[k] = { expected: v, actual: out.secrets[k] || null, ok: out.secrets[k] === v };
}

writeFileSync(join(__dirname, 'estado-inicial.json'), JSON.stringify(out, null, 2));
console.log('workflows', wfs.length, 'historyIssues', out.workflowHistoryIssues.length);
console.log('webhooks', hooks.length);
console.log('expectedMatch', Object.values(out.expectedMatch).filter((x) => !x.ok));
await c.end();
