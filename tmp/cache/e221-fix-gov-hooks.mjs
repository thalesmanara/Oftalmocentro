#!/usr/bin/env node
/**
 * Fix invalidation hooks on IA - PUBLICAR PROMPT / ROLLBACK —
 * attach after successful publish/rollback nodes, not error branches.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const INVALIDATE_ID = 'c221InvalidateEvent01';

const client = new pg.Client({ connectionString: PG });
await client.connect();

async function fixWorkflow(id, eventType, successNodeNames, idField, extractExpr) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows.length) return;
  const name = rows[0].name;
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  // remove bad hook
  nodes = nodes.filter((n) => n.name !== 'IA - INVALIDAR CACHE POR EVENTO');
  for (const k of Object.keys(connections)) {
    if (!connections[k]?.main) continue;
    connections[k].main = connections[k].main.map((branch) =>
      (branch || []).filter((c) => c.node !== 'IA - INVALIDAR CACHE POR EVENTO'),
    );
  }
  delete connections['IA - INVALIDAR CACHE POR EVENTO'];

  const value = {
    eventType: `={{ '${eventType}' }}`,
    reasonCode: `={{ '${eventType}' }}`,
    requestId: `={{ String(($json&&$json.requestId)||$execution.id||'') }}`,
    userId: '={{ "" }}',
    documentId: '={{ "" }}',
    documentVersionId: '={{ "" }}',
    promptVersionId: '={{ "" }}',
    retrievalConfigVersionId: '={{ "" }}',
    contextConfigVersionId: '={{ "" }}',
    modelName: '={{ "" }}',
  };
  value[idField] = extractExpr;

  const maxX = Math.max(...nodes.map((n) => (n.position && n.position[0]) || 0), 0);
  nodes.push({
    id: randomUUID(),
    name: 'IA - INVALIDAR CACHE POR EVENTO',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [maxX + 220, 200],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: INVALIDATE_ID },
      workflowInputs: { mappingMode: 'defineBelow', value },
      options: {},
    },
  });

  // Find success node
  const success = nodes.find((n) => successNodeNames.some((s) => n.name === s || n.name.includes(s)));
  if (!success) {
    console.log('no success node', name, nodes.map((n) => n.name));
    return;
  }

  // What currently follows success?
  const prevOut = connections[success.name]?.main?.[0] || [];
  connections[success.name] = {
    main: [[{ node: 'IA - INVALIDAR CACHE POR EVENTO', type: 'main', index: 0 }]],
  };
  connections['IA - INVALIDAR CACHE POR EVENTO'] = {
    main: [prevOut.length ? prevOut : []],
  };

  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,'fix invalidate hook',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log('fixed', name, 'after', success.name, '→', prevOut.map((c) => c.node));
}

// dump node names first
for (const id of ['L8FL9uMkcqiVpskV', 'dziymkwKvfYJmBUp']) {
  const { rows } = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log(rows[0].name, nodes.map((n) => n.name).join(' | '));
}

await fixWorkflow(
  'L8FL9uMkcqiVpskV',
  'AI_PROMPT_PUBLISHED',
  ['Marcar anterior ARCHIVED', 'Upsert secret', 'Atualizar secret', 'Publicação OK', 'Commit publish'],
  'promptVersionId',
  `={{ (() => { const j=$json||{}; return String(j.previousVersionId||j.oldVersionId||j.archivedId||j.id||''); })() }}`,
);

await fixWorkflow(
  'dziymkwKvfYJmBUp',
  'AI_PROMPT_ROLLBACK',
  ['Rollback OK', 'Atualizar secret', 'Upsert secret', 'Marcar ARCHIVED'],
  'promptVersionId',
  `={{ (() => { const j=$json||{}; return String(j.fromVersionId||j.rolledBackFromId||j.previousVersionId||j.id||''); })() }}`,
);

await client.end();
