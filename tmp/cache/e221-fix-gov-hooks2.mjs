#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const INVALIDATE_ID = 'c221InvalidateEvent01';
const client = new pg.Client({ connectionString: PG });
await client.connect();

async function rewire(id, eventType, afterName, idField, extractExpr) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const name = rows[0].name;
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

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

  const after = nodes.find((n) => n.name === afterName);
  if (!after) throw new Error('missing ' + afterName);
  const maxX = (after.position?.[0] || 0) + 220;
  nodes.push({
    id: randomUUID(),
    name: 'IA - INVALIDAR CACHE POR EVENTO',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [maxX, after.position?.[1] || 200],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: INVALIDATE_ID },
      workflowInputs: { mappingMode: 'defineBelow', value },
      options: {},
    },
  });

  const prevOut = connections[afterName]?.main?.[0] || [];
  // Only invalidate on success path: Montar resultado after publish — but Montar resultado may also be used from blocked? Check connections to Montar resultado
  connections[afterName] = {
    main: [[{ node: 'IA - INVALIDAR CACHE POR EVENTO', type: 'main', index: 0 }, ...prevOut]],
  };
  // fire-and-forget parallel: keep previous outputs AND invalidate
  connections['IA - INVALIDAR CACHE POR EVENTO'] = { main: [[]] };

  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,'invalidate after success',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log('OK', name, 'after', afterName, 'prevOut', prevOut.map((c) => c.node));
}

// dump who feeds Montar resultado
for (const id of ['L8FL9uMkcqiVpskV', 'dziymkwKvfYJmBUp']) {
  const { rows } = await client.query(`SELECT name, connections FROM workflow_entity WHERE id=$1`, [id]);
  const c = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  console.log('\n', rows[0].name);
  for (const [from, conn] of Object.entries(c)) {
    for (const branch of conn.main || []) {
      for (const x of branch || []) {
        if (/Montar resultado|Executar publicação|Executar rollback/.test(x.node) || /Montar resultado|Executar/.test(from)) {
          console.log(from, '→', x.node);
        }
      }
    }
  }
}

await rewire(
  'L8FL9uMkcqiVpskV',
  'AI_PROMPT_PUBLISHED',
  'Executar publicação',
  'promptVersionId',
  `={{ (() => { const j=$json||{}; return String(j.previous_version_id||j.previousVersionId||j.old_id||''); })() }}`,
);
await rewire(
  'dziymkwKvfYJmBUp',
  'AI_PROMPT_ROLLBACK',
  'Executar rollback',
  'promptVersionId',
  `={{ (() => { const j=$json||{}; return String(j.from_version_id||j.previousVersionId||j.old_id||''); })() }}`,
);

await client.end();
