#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(`SELECT jsonb_build_object(
  'definition', (SELECT to_jsonb(d) FROM ai_evidence_configs d WHERE code='AI_QUERY_EVIDENCE' LIMIT 1),
  'versions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) ORDER BY v.version_number DESC) FROM ai_evidence_config_versions v), '[]'::jsonb),
  'activeVersion', (SELECT jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) FROM ai_evidence_config_versions v WHERE v.status='PUBLISHED' ORDER BY v.published_at DESC NULLS LAST LIMIT 1)
) AS data`);
console.log(JSON.stringify(r.rows[0].data, null, 2).slice(0, 800));

// check detail workflow restore code / recent executions
const nodes = await c.query(`SELECT nodes FROM workflow_entity WHERE id='c23EvidenceDetail001'`);
const n = typeof nodes.rows[0].nodes === 'string' ? JSON.parse(nodes.rows[0].nodes) : nodes.rows[0].nodes;
console.log(
  'restore snippet',
  n.find((x) => x.name === 'Restaurar request')?.parameters?.jsCode?.slice(0, 400),
);
await c.end();
