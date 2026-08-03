#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function bump(id, desc, mutator) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  mutator(nodes);
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, desc],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log(rows[0].name, versionId);
  return versionId;
}

const publishSql = `WITH pub AS (
  UPDATE ai_context_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      published_by=NULLIF('{{ $('Avaliar run').first().json.userId || "" }}','')::uuid,
      validation_run_id=NULLIF('{{ $('Avaliar run').first().json.validationRunId || "" }}','')::uuid
  WHERE v.id = NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (
  INSERT INTO app_secrets (key, value, updated_at)
  VALUES ('context_active_mode', (SELECT mode FROM pub), NOW())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
), s2 AS (
  INSERT INTO app_secrets (key, value, updated_at)
  VALUES ('context_active_version', (SELECT version_label FROM pub), NOW())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
)
SELECT * FROM pub;`;

const rollbackSql = `WITH pub AS (
  UPDATE ai_context_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      notes = COALESCE(notes,'') || ' | rollback: ' || '{{ String($('Preparar rollback').first().json.reason || "").replace(/'/g, "''") }}'
  WHERE v.id = NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (
  INSERT INTO app_secrets (key, value, updated_at)
  VALUES ('context_active_mode', (SELECT mode FROM pub), NOW())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
), s2 AS (
  INSERT INTO app_secrets (key, value, updated_at)
  VALUES ('context_active_version', (SELECT version_label FROM pub), NOW())
  ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()
)
SELECT * FROM pub;`;

const pubVid = await bump('f83073bfb4154115', 'Fix context secrets upsert without created_at', (nodes) => {
  nodes.find((x) => /Promover/i.test(x.name)).parameters.query = publishSql;
});
const rbVid = await bump('708bf587fb73467f', 'Fix context secrets upsert without created_at', (nodes) => {
  nodes.find((x) => /Promover/i.test(x.name)).parameters.query = rollbackSql;
});

await client.end();
console.log(JSON.stringify({ pubVid, rbVid }));
