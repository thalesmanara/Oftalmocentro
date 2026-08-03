#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import crypto from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const workflows = await client.query(`
  SELECT id, name, active, "activeVersionId",
    (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(nodes::jsonb)='array' THEN nodes::jsonb ELSE '[]'::jsonb END)) AS node_count
  FROM workflow_entity
  WHERE name ILIKE '%retrieval%'
     OR name ILIKE '%RE-RANQUEAR%'
     OR name ILIKE '%CARREGAR RETRIEVAL%'
     OR name ILIKE '%EXECUTAR DATASET%'
     OR name ILIKE '%EXECUTAR TESTE%'
     OR name = 'Consulta IA'
  ORDER BY name
`);

// Fix node_count - nodes may be json not jsonb
const w2 = await client.query(`
  SELECT id, name, active, "activeVersionId" FROM workflow_entity
  WHERE name ILIKE '%retrieval%' OR name ILIKE '%RE-RANQUEAR%' OR name ILIKE '%CARREGAR RETRIEVAL%'
     OR name ILIKE '%EXECUTAR DATASET%' OR name ILIKE '%EXECUTAR TESTE%' OR name = 'Consulta IA'
  ORDER BY name
`);

const details = [];
for (const w of w2.rows) {
  const ent = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id=$1`, [w.id]);
  const hist = w.activeVersionId
    ? await client.query(
        `SELECT nodes, connections FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
        [w.id, w.activeVersionId],
      )
    : { rows: [] };
  const enodes = typeof ent.rows[0].nodes === 'string' ? JSON.parse(ent.rows[0].nodes) : ent.rows[0].nodes;
  const hnodes = hist.rows[0]
    ? typeof hist.rows[0].nodes === 'string'
      ? JSON.parse(hist.rows[0].nodes)
      : hist.rows[0].nodes
    : null;
  const eHash = crypto.createHash('sha256').update(JSON.stringify(enodes)).digest('hex').slice(0, 12);
  const hHash = hnodes
    ? crypto.createHash('sha256').update(JSON.stringify(hnodes)).digest('hex').slice(0, 12)
    : null;
  details.push({
    id: w.id,
    name: w.name,
    active: w.active,
    activeVersionId: w.activeVersionId,
    nodeNames: enodes.map((n) => n.name),
    drift: hHash ? eHash !== hHash : null,
    eHash,
    hHash,
  });
}

const versions = await client.query(
  `SELECT id, version_number, version_label, status, mode, left(content_hash,12) AS hash
   FROM ai_retrieval_config_versions ORDER BY version_number`,
);
const secrets = await client.query(`SELECT key, value FROM app_secrets WHERE key LIKE 'retrieval%' ORDER BY key`);

const caseCols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_cases' AND column_name ILIKE '%expect%'
  ORDER BY column_name`);
const caseStats = await client.query(`
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE expected_document_id IS NOT NULL)::int AS with_doc,
    COUNT(*) FILTER (WHERE expected_document_ids IS NOT NULL AND cardinality(expected_document_ids)>0)::int AS with_docs,
    COUNT(*) FILTER (WHERE status='active')::int AS active,
    COUNT(DISTINCT group_name)::int AS groups
  FROM ai_test_cases`);
const groups = await client.query(`
  SELECT group_name, COUNT(*)::int AS n
  FROM ai_test_cases WHERE status='active'
  GROUP BY group_name ORDER BY group_name`);

const metricCols = await client.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_name IN ('ai_test_runs','ai_test_results','ai_test_metrics')
    AND (column_name ILIKE '%retrieval%' OR column_name ILIKE '%rerank%' OR column_name ILIKE '%recall%'
         OR column_name ILIKE '%precision%' OR column_name ILIKE '%mrr%' OR column_name ILIKE '%hit%')
  ORDER BY table_name, column_name`);

const out = {
  workflows: details,
  versions: versions.rows,
  secrets: secrets.rows,
  caseExpectCols: caseCols.rows,
  caseStats: caseStats.rows[0],
  groups: groups.rows,
  metricCols: metricCols.rows,
};
writeFileSync(new URL('./_inspect-consolidacao.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
