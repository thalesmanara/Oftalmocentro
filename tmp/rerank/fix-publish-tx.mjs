#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const PUBLISH_TX = `WITH target AS (
  SELECT id, retrieval_config_id, mode, version_label FROM ai_retrieval_config_versions
  WHERE id=NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
), clear AS (
  -- Zera PUBLISHED antes de promover (evita uq_ai_retrieval_one_published no mesmo statement)
  UPDATE ai_retrieval_config_versions v
  SET status = CASE
    WHEN v.id = (SELECT id FROM target) THEN 'VALIDATING'
    ELSE 'ARCHIVED'
  END
  WHERE v.retrieval_config_id = (SELECT retrieval_config_id FROM target)
    AND (v.status = 'PUBLISHED' OR v.id = (SELECT id FROM target))
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      published_by=NULLIF('{{ $('Avaliar run').first().json.userId || "" }}','')::uuid,
      validation_run_id=NULLIF('{{ $('Avaliar run').first().json.validationRunId || "" }}','')::uuid
  WHERE v.id = (SELECT id FROM target)
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;`;

const ROLLBACK_TX = `WITH target AS (
  SELECT * FROM ai_retrieval_config_versions WHERE id=NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
), clear AS (
  UPDATE ai_retrieval_config_versions v
  SET status = CASE
    WHEN v.id = (SELECT id FROM target) THEN 'VALIDATING'
    ELSE 'ARCHIVED'
  END
  WHERE v.retrieval_config_id = (SELECT retrieval_config_id FROM target)
    AND (v.status = 'PUBLISHED' OR v.id = (SELECT id FROM target))
  RETURNING v.id
), pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      notes = COALESCE(notes,'') || ' | rollback: ' || '{{ String($('Preparar rollback').first().json.reason || "").replace(/'/g, "''") }}'
  WHERE v.id = (SELECT id FROM target)
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;`;

async function patch(wfId, nodeName, query) {
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [wfId],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === nodeName);
  if (!n) throw new Error(`missing ${nodeName} in ${wfId}`);
  n.parameters.query = query;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
    JSON.stringify(nodes),
    wfId,
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
      [JSON.stringify(nodes), wfId, rows[0].activeVersionId],
    );
  }
  console.log('patched', wfId, nodeName);
}

await patch('BAHKNoJM7VdYU8UE', 'Publicar TX', PUBLISH_TX);
await patch('FdaMsXY4nXEO0xV8', 'Executar rollback', ROLLBACK_TX);

// cleanup leftover test draft
await client.query(
  `UPDATE ai_retrieval_config_versions SET status='REJECTED', notes=COALESCE(notes,'')||' [optest-cleanup]'
   WHERE version_label LIKE 'tmp-optest-%' AND status <> 'PUBLISHED'`,
);

const secrets = await client.query(
  `SELECT key,value FROM app_secrets WHERE key IN ('retrieval_active_mode','retrieval_active_version')`,
);
const pubs = await client.query(
  `SELECT version_label, status FROM ai_retrieval_config_versions WHERE status='PUBLISHED'`,
);
console.log({ secrets: secrets.rows, pubs: pubs.rows });
await client.end();
