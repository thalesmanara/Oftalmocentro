#!/usr/bin/env node
/**
 * Etapa 27 — architecture / versions / workflows audit
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const out = { at: new Date().toISOString(), findings: [], ok: [], warn: [], fail: [] };
const note = (arr, msg) => arr.push(msg);

// Secrets / published versions
const { rows: secrets } = await c.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE '%active%' OR key LIKE '%version%' OR key LIKE '%mode%' ORDER BY key`,
);
out.secrets = secrets;

// Duplicate PUBLISHED per governance tables
const govTables = [
  ['ai_prompt_versions', 'prompt'],
  ['ai_retrieval_config_versions', 'retrieval'],
  ['ai_context_config_versions', 'context'],
  ['ai_cache_config_versions', 'cache'],
  ['ai_evidence_config_versions', 'evidence'],
  ['ai_response_quality_config_versions', 'response_quality'],
];
out.publishedCounts = {};
for (const [table, label] of govTables) {
  try {
    const { rows } = await c.query(
      `SELECT status, COUNT(*)::int AS n FROM ${table} GROUP BY status ORDER BY status`,
    );
    out.publishedCounts[label] = rows;
    const pub = rows.find((r) => r.status === 'PUBLISHED');
    if (!pub || pub.n !== 1) note(out.fail, `${label}: PUBLISHED count=${pub?.n ?? 0}`);
    else note(out.ok, `${label}: exactly 1 PUBLISHED`);
  } catch (e) {
    note(out.warn, `${label}: table missing or error — ${e.message}`);
  }
}

// Active workflows + history sync sample
const { rows: wfs } = await c.query(`
  SELECT id, name, active, "versionId", "activeVersionId",
         (SELECT COUNT(*)::int FROM workflow_history h WHERE h."workflowId"=w.id) AS hist_count,
         EXISTS (
           SELECT 1 FROM workflow_history h
           WHERE h."workflowId"=w.id AND h."versionId"=w."activeVersionId"
         ) AS history_synced
  FROM workflow_entity w
  WHERE active = true
  ORDER BY name
`);
out.activeWorkflows = wfs.map((w) => ({
  id: w.id,
  name: w.name,
  hist: w.hist_count,
  synced: w.history_synced,
  versionMatch: w.versionId === w.activeVersionId,
}));
const unsynced = wfs.filter((w) => !w.history_synced || w.versionId !== w.activeVersionId);
if (unsynced.length) note(out.warn, `active workflows history mismatch: ${unsynced.map((w) => w.name).join(', ')}`);
else note(out.ok, `all ${wfs.length} active workflows have history sync`);

// Webhooks without auth heuristic (trigger webhook nodes)
const { rows: hooks } = await c.query(`
  SELECT id, name, nodes::text AS nodes
  FROM workflow_entity
  WHERE active=true AND nodes::text ILIKE '%webhook%'
`);
const publicish = [];
for (const h of hooks) {
  const hasAuth =
    /Validar auth|validar auth|jwt|Bearer|session/i.test(h.nodes) ||
    /authentication|headerAuth/i.test(h.nodes);
  const isWebhook = /n8n-nodes-base\.webhook/i.test(h.nodes);
  if (isWebhook && !hasAuth) {
    // allow health? still flag
    publicish.push(h.name);
  }
}
out.webhooksPossiblyUnauthed = publicish;
if (publicish.length) note(out.warn, `webhooks without obvious auth node: ${publicish.slice(0, 20).join(' | ')}`);
else note(out.ok, 'active webhook workflows appear to have auth heuristics');

// FK / indexes sample on critical tables
const { rows: fks } = await c.query(`
  SELECT tc.table_name, COUNT(*)::int AS fk_count
  FROM information_schema.table_constraints tc
  WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
    AND tc.table_name IN ('documents','document_versions','document_chunks','ai_test_results','ai_response_quality_config_versions','user_permissions','audit_logs')
  GROUP BY tc.table_name ORDER BY 1
`);
out.foreignKeys = fks;

const { rows: indexes } = await c.query(`
  SELECT tablename, indexname FROM pg_indexes
  WHERE schemaname='public'
    AND tablename IN ('documents','document_chunks','audit_logs','ai_test_results','user_sessions')
  ORDER BY 1,2
`);
out.indexesSample = indexes;

// LGPD-ish columns in audit / cache / dataset
const { rows: sensCols } = await c.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema='public'
    AND (
      column_name ILIKE '%cpf%' OR column_name ILIKE '%telefone%' OR column_name ILIKE '%phone%'
      OR column_name ILIKE '%salary%' OR column_name ILIKE '%salario%' OR column_name ILIKE '%password%'
      OR column_name ILIKE '%secret%' OR column_name ILIKE '%api_key%' OR column_name ILIKE '%token%'
    )
  ORDER BY 1,2
`);
out.sensitiveColumns = sensCols;

// Orphan check: inactive workflows named SYSTEM/IA with no history
const { rows: orphans } = await c.query(`
  SELECT id, name, active FROM workflow_entity
  WHERE active=false AND (name ILIKE 'IA -%' OR name ILIKE 'SYSTEM%' OR name ILIKE 'GET %' OR name ILIKE 'POST %')
  ORDER BY name LIMIT 40
`);
out.inactiveNamed = orphans.length;

writeFileSync(new URL('./_e27-arch-audit.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('OK', out.ok.length, 'WARN', out.warn.length, 'FAIL', out.fail.length);
out.ok.forEach((m) => console.log('✓', m));
out.warn.forEach((m) => console.log('!', m));
out.fail.forEach((m) => console.log('✗', m));
await c.end();
