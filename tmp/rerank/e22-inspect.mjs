#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const out = { at: new Date().toISOString() };

out.context = (await client.query(`SELECT version_label, status, mode FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT') ORDER BY 1`)).rows;
out.retrieval = (await client.query(`SELECT version_label, status, mode FROM ai_retrieval_config_versions WHERE status IN ('PUBLISHED','DRAFT')`)).rows;
out.secrets = (await client.query(`SELECT key, value FROM app_secrets WHERE key LIKE '%active%' OR key LIKE '%cache%' ORDER BY 1`)).rows;
out.cacheTables = (await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%cache%' OR table_name ILIKE '%semantic%') ORDER BY 1`)).rows;

{
  const { rows } = await client.query(`SELECT id, name, active, "versionId", nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  out.consulta = {
    versionId: rows[0].versionId,
    active: rows[0].active,
    nodeOrder: nodes.map((n) => n.name),
    executeWorkflows: nodes.filter((n) => n.type === 'n8n-nodes-base.executeWorkflow').map((n) => ({
      name: n.name,
      workflowId: n.parameters?.workflowId?.value || n.parameters?.workflowId,
      inputs: Object.keys(n.parameters?.workflowInputs?.value || {}),
    })),
  };
}

out.resultsCols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_results' ORDER BY 1`)).rows.map((r) => r.column_name);
out.runsCols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_runs' ORDER BY 1`)).rows.map((r) => r.column_name);

out.results7d = (await client.query(`
  SELECT COUNT(*)::int AS n, COUNT(DISTINCT run_id)::int AS runs,
    AVG(duration_ms)::int AS avg_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_ms)::int AS p90_ms
  FROM ai_test_results WHERE created_at > NOW() - INTERVAL '7 days'`)).rows[0];

out.auditConsulta7d = (await client.query(`
  SELECT COUNT(*)::int AS n FROM audit_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
    AND (action ILIKE '%AI_QUERY%' OR action ILIKE '%CONSULTA%' OR COALESCE(path,'') ILIKE '%consulta%')`)).rows[0];

out.users = (await client.query(`SELECT COUNT(*)::int AS n FROM users`)).rows[0];
out.sessions = (await client.query(`SELECT COUNT(*)::int AS n FROM user_sessions WHERE COALESCE(revoked,false)=false AND expires_at>NOW()`)).rows[0];
out.docs = (await client.query(`
  SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
         COUNT(*) FILTER (WHERE deleted_at IS NULL AND updated_at > NOW() - INTERVAL '7 days')::int AS updated_7d
  FROM documents`)).rows[0];

out.promptPublished = (await client.query(`
  SELECT id, version_number, model_name FROM ai_prompt_versions WHERE status='PUBLISHED' LIMIT 1`)).rows[0];

out.publishedContext = (await client.query(`SELECT id, version_label, content_hash FROM ai_context_config_versions WHERE status='PUBLISHED'`)).rows[0];
out.publishedRetrieval = (await client.query(`SELECT id, version_label, content_hash FROM ai_retrieval_config_versions WHERE status='PUBLISHED'`)).rows[0];

writeFileSync(new URL('./_e22-inspect.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
