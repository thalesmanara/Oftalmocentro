#!/usr/bin/env node
/**
 * Split publish/rollback into two Postgres statements to satisfy
 * unique partial index uq_ai_retrieval_one_published.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ARCHIVE_Q = `UPDATE ai_retrieval_config_versions v
SET status='ARCHIVED'
WHERE v.status='PUBLISHED'
  AND v.retrieval_config_id = (
    SELECT retrieval_config_id FROM ai_retrieval_config_versions
    WHERE id = NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
  )
  AND v.id <> NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
RETURNING v.id;`;

const PROMOTE_Q = `WITH pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      published_by=NULLIF('{{ $('Avaliar run').first().json.userId || "" }}','')::uuid,
      validation_run_id=NULLIF('{{ $('Avaliar run').first().json.validationRunId || "" }}','')::uuid
  WHERE v.id = NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;`;

const RB_ARCHIVE_Q = `UPDATE ai_retrieval_config_versions v
SET status='ARCHIVED'
WHERE v.status='PUBLISHED'
  AND v.retrieval_config_id = (
    SELECT retrieval_config_id FROM ai_retrieval_config_versions
    WHERE id = NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
  )
  AND v.id <> NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
RETURNING v.id;`;

const RB_PROMOTE_Q = `WITH pub AS (
  UPDATE ai_retrieval_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      notes = COALESCE(notes,'') || ' | rollback: ' || '{{ String($('Preparar rollback').first().json.reason || "").replace(/'/g, "''") }}'
  WHERE v.id = NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;`;

async function patchPublish() {
  const { rows } = await client.query(
    `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='BAHKNoJM7VdYU8UE'`,
  );
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  const tx = nodes.find((n) => n.name === 'Publicar TX');
  tx.name = 'Arquivar published';
  tx.parameters.query = ARCHIVE_Q;

  let promote = nodes.find((n) => n.name === 'Promover PUBLISHED');
  if (!promote) {
    promote = {
      id: randomUUID(),
      name: 'Promover PUBLISHED',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [tx.position[0] + 220, tx.position[1]],
      credentials: { postgres: CRED },
      parameters: { operation: 'executeQuery', options: {}, query: PROMOTE_Q },
    };
    nodes.push(promote);
  } else {
    promote.parameters.query = PROMOTE_Q;
  }

  // Run ok? true→Arquivar; Arquivar→Promover; Promover→Montar publish ok (whatever was after Publicar TX)
  const after = connections['Publicar TX'] || connections['Arquivar published'];
  connections['Arquivar published'] = {
    main: [[{ node: 'Promover PUBLISHED', type: 'main', index: 0 }]],
  };
  connections['Promover PUBLISHED'] = after || {
    main: [[{ node: 'Montar publish ok', type: 'main', index: 0 }]],
  };
  delete connections['Publicar TX'];

  // Fix Run ok? / any node pointing to Publicar TX
  for (const [src, conn] of Object.entries(connections)) {
    for (const branch of conn.main || []) {
      for (const link of branch || []) {
        if (link.node === 'Publicar TX') link.node = 'Arquivar published';
      }
    }
  }

  // Montar publish ok should read from Promover PUBLISHED
  const montar = nodes.find((n) => n.name === 'Montar publish ok' || n.name.includes('Montar'));
  if (montar?.parameters?.jsCode?.includes('Publicar TX')) {
    montar.parameters.jsCode = montar.parameters.jsCode.replaceAll('Publicar TX', 'Promover PUBLISHED');
  }
  // Also find code that uses $input from Publicar
  for (const n of nodes) {
    if (n.parameters?.jsCode?.includes("$('Publicar TX')")) {
      n.parameters.jsCode = n.parameters.jsCode.replaceAll("$('Publicar TX')", "$('Promover PUBLISHED')");
    }
  }

  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id='BAHKNoJM7VdYU8UE'`,
    [JSON.stringify(nodes), JSON.stringify(connections)],
  );
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"='BAHKNoJM7VdYU8UE' AND "versionId"=$3`,
      [JSON.stringify(nodes), JSON.stringify(connections), rows[0].activeVersionId],
    );
  }
  console.log('publish split OK', nodes.map((n) => n.name).filter((n) => /Arquivar|Promover|Montar|Run/.test(n)));
}

async function patchRollback() {
  const { rows } = await client.query(
    `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='FdaMsXY4nXEO0xV8'`,
  );
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  const tx = nodes.find((n) => n.name === 'Executar rollback' || n.name === 'Arquivar published RB');
  if (!tx) throw new Error('rollback node missing');
  const oldName = tx.name;
  tx.name = 'Arquivar published RB';
  tx.parameters.query = RB_ARCHIVE_Q;

  let promote = nodes.find((n) => n.name === 'Promover rollback');
  if (!promote) {
    promote = {
      id: randomUUID(),
      name: 'Promover rollback',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [tx.position[0] + 220, tx.position[1]],
      credentials: { postgres: CRED },
      parameters: { operation: 'executeQuery', options: {}, query: RB_PROMOTE_Q },
    };
    nodes.push(promote);
  } else {
    promote.parameters.query = RB_PROMOTE_Q;
  }

  const after = connections[oldName] || connections['Arquivar published RB'];
  connections['Arquivar published RB'] = {
    main: [[{ node: 'Promover rollback', type: 'main', index: 0 }]],
  };
  connections['Promover rollback'] = after || {
    main: [[{ node: 'Montar rollback ok', type: 'main', index: 0 }]],
  };
  delete connections[oldName];
  delete connections['Executar rollback'];

  for (const [src, conn] of Object.entries(connections)) {
    for (const branch of conn.main || []) {
      for (const link of branch || []) {
        if (link.node === 'Executar rollback' || link.node === oldName) link.node = 'Arquivar published RB';
      }
    }
  }
  for (const n of nodes) {
    if (n.parameters?.jsCode?.includes("$('Executar rollback')")) {
      n.parameters.jsCode = n.parameters.jsCode.replaceAll(
        "$('Executar rollback')",
        "$('Promover rollback')",
      );
    }
  }

  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id='FdaMsXY4nXEO0xV8'`,
    [JSON.stringify(nodes), JSON.stringify(connections)],
  );
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"='FdaMsXY4nXEO0xV8' AND "versionId"=$3`,
      [JSON.stringify(nodes), JSON.stringify(connections), rows[0].activeVersionId],
    );
  }
  console.log('rollback split OK');
}

await patchPublish();
await patchRollback();
await client.end();
