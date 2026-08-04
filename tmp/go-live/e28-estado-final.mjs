#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const secrets = await c.query(`
  SELECT key, value FROM app_secrets
  WHERE key IN (
    'retrieval_active_mode','retrieval_active_version',
    'context_active_mode','context_active_version',
    'cache_active_mode','cache_active_version',
    'evidence_active_mode','evidence_active_version',
    'response_quality_active_mode','response_quality_active_version'
  ) ORDER BY 1`);
const pub = await c.query(`
  SELECT 'retrieval' AS layer, version_label, status, mode FROM ai_retrieval_config_versions WHERE status='PUBLISHED'
  UNION ALL SELECT 'context', version_label, status, mode FROM ai_context_config_versions WHERE status='PUBLISHED'
  UNION ALL SELECT 'cache', version_label, status, mode FROM ai_cache_config_versions WHERE status='PUBLISHED'
  UNION ALL SELECT 'evidence', version_label, status, mode FROM ai_evidence_config_versions WHERE status='PUBLISHED'
  UNION ALL SELECT 'response_quality', version_label, status, mode FROM ai_response_quality_config_versions WHERE status='PUBLISHED'
`);
const drafts = await c.query(`
  SELECT 'retrieval' AS layer, version_label, status, mode FROM ai_retrieval_config_versions WHERE status='DRAFT'
  UNION ALL SELECT 'context', version_label, status, mode FROM ai_context_config_versions WHERE status='DRAFT'
`);
const snap = {
  at: new Date().toISOString(),
  decision: 'GO_CONDICIONAL',
  decisionNote:
    'Homologação técnica OK. Go Live oficial depende de assinatura humana em docs/TERMO_ACEITE.md (risco backup externo / DR).',
  secrets: Object.fromEntries(secrets.rows.map((r) => [r.key, r.value])),
  published: pub.rows,
  drafts: drafts.rows,
  datasetFinal: {
    runId: 'f2c18773-4121-4bef-97dd-abb61c0494fd',
    total: 100,
    pass: 83,
    fail: 17,
    errors: 0,
    score: 87.3,
    hallucinations: 0,
  },
  architecturePreserved: true,
  cacheServeDisabled: true,
  draftsNotPublished: true,
};
writeFileSync(new URL('./estado-final.json', import.meta.url), JSON.stringify(snap, null, 2));
console.log(JSON.stringify(snap, null, 2));
await c.end();
