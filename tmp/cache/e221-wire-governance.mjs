#!/usr/bin/env node
/**
 * Etapa 22.1 — wire governance publish/rollback to IA - INVALIDAR CACHE POR EVENTO.
 * Document events covered by DB triggers. Does not change prompt/retrieval/context production configs.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const INVALIDATE_ID = 'c221InvalidateEvent01';

const TARGETS = [
  {
    id: 'L8FL9uMkcqiVpskV',
    eventType: 'AI_PROMPT_PUBLISHED',
    versionField: 'promptVersionId',
    // previous published id if available
    extract: `={{ (() => { const j=$json||{}; return String(j.previousVersionId||j.oldVersionId||j.archivedVersionId||j.previous_id||''); })() }}`,
  },
  {
    id: 'dziymkwKvfYJmBUp',
    eventType: 'AI_PROMPT_ROLLBACK',
    extract: `={{ (() => { const j=$json||{}; return String(j.rolledBackFromId||j.previousVersionId||j.fromVersionId||''); })() }}`,
  },
  {
    id: 'BAHKNoJM7VdYU8UE',
    eventType: 'AI_RETRIEVAL_CONFIG_PUBLISHED',
    field: 'retrievalConfigVersionId',
    extract: `={{ (() => { const j=$json||{}; return String(j.previousVersionId||j.oldVersionId||j.archivedVersionId||''); })() }}`,
  },
  {
    id: 'FdaMsXY4nXEO0xV8',
    eventType: 'AI_RETRIEVAL_CONFIG_ROLLBACK',
    field: 'retrievalConfigVersionId',
    extract: `={{ (() => { const j=$json||{}; return String(j.rolledBackFromId||j.previousVersionId||''); })() }}`,
  },
  {
    id: 'f83073bfb4154115',
    eventType: 'AI_CONTEXT_CONFIG_PUBLISHED',
    field: 'contextConfigVersionId',
    extract: `={{ (() => { const j=$json||{}; return String(j.previousVersionId||j.oldVersionId||j.archivedVersionId||''); })() }}`,
  },
  {
    id: '708bf587fb73467f',
    eventType: 'AI_CONTEXT_CONFIG_ROLLBACK',
    field: 'contextConfigVersionId',
    extract: `={{ (() => { const j=$json||{}; return String(j.rolledBackFromId||j.previousVersionId||''); })() }}`,
  },
  // HTTP wrappers
  {
    id: 'sHlvvNBw1uTCtS3P',
    eventType: 'AI_PROMPT_PUBLISHED',
    extract: `={{ (() => { const j=$json||{}; const d=j.data||j; return String(d.previousVersionId||d.oldVersionId||''); })() }}`,
  },
  {
    id: 'lWMX8ESUgPOuPd8T',
    eventType: 'AI_PROMPT_ROLLBACK',
    extract: `={{ (() => { const j=$json||{}; const d=j.data||j; return String(d.rolledBackFromId||d.previousVersionId||''); })() }}`,
  },
];

const client = new pg.Client({ connectionString: PG });
await client.connect();

function makeInvalidateNode(eventType, idField, extractExpr) {
  const value = {
    eventType: `={{ '${eventType}' }}`,
    reasonCode: `={{ '${eventType}' }}`,
    requestId: `={{ String(($json&&$json.requestId)||$execution.id||'') }}`,
    userId: `={{ String(($json&&$json.userId)||'') }}`,
    documentId: '={{ "" }}',
    documentVersionId: '={{ "" }}',
    promptVersionId: '={{ "" }}',
    retrievalConfigVersionId: '={{ "" }}',
    contextConfigVersionId: '={{ "" }}',
    modelName: '={{ "" }}',
  };
  value[idField] = extractExpr;
  return {
    id: randomUUID(),
    name: 'IA - INVALIDAR CACHE POR EVENTO',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [2400, 600],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: INVALIDATE_ID },
      workflowInputs: { mappingMode: 'defineBelow', value },
      options: {},
    },
  };
}

for (const t of TARGETS) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, active FROM workflow_entity WHERE id=$1`,
    [t.id],
  );
  if (!rows.length) {
    console.log('SKIP missing', t.id);
    continue;
  }
  const name = rows[0].name;
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  // remove prior wire
  nodes = nodes.filter((n) => n.name !== 'IA - INVALIDAR CACHE POR EVENTO');
  for (const k of Object.keys(connections)) {
    if (!connections[k]?.main) continue;
    connections[k].main = connections[k].main.map((branch) =>
      (branch || []).filter((c) => c.node !== 'IA - INVALIDAR CACHE POR EVENTO'),
    );
  }

  const idField =
    t.field ||
    (t.eventType.includes('RETRIEVAL')
      ? 'retrievalConfigVersionId'
      : t.eventType.includes('CONTEXT')
        ? 'contextConfigVersionId'
        : 'promptVersionId');

  const invNode = makeInvalidateNode(t.eventType, idField, t.extract);
  // place near end
  const maxX = Math.max(...nodes.map((n) => (n.position && n.position[0]) || 0), 0);
  invNode.position = [maxX + 220, 400];
  nodes.push(invNode);

  // Find terminal success nodes without outgoing (prefer Respond / Sucesso / Retornar / Finalizar)
  const targets = new Set();
  for (const arr of Object.values(connections)) {
    for (const branch of arr.main || []) {
      for (const c of branch || []) targets.add(c.node);
    }
  }
  const terminals = nodes
    .filter((n) => n.name !== 'IA - INVALIDAR CACHE POR EVENTO')
    .filter((n) => !targets.has(n.name))
    .filter((n) => /respond|sucesso|success|retornar|final|responder|http/i.test(n.name) || n.type.includes('respondToWebhook'));

  let hooked = false;
  // Prefer hooking AFTER the last non-webhook business node that currently feeds respond
  for (const [from, conn] of Object.entries(connections)) {
    if (!conn.main) continue;
    for (let bi = 0; bi < conn.main.length; bi++) {
      const branch = conn.main[bi] || [];
      const idx = branch.findIndex((c) => /respond|responder/i.test(c.node) || c.node.includes('Respond'));
      if (idx >= 0) {
        // insert invalidate before respond: from -> invalidate -> respond
        const respond = branch[idx];
        branch[idx] = { node: 'IA - INVALIDAR CACHE POR EVENTO', type: 'main', index: 0 };
        connections['IA - INVALIDAR CACHE POR EVENTO'] = {
          main: [[{ node: respond.node, type: 'main', index: 0 }]],
        };
        hooked = true;
        break;
      }
    }
    if (hooked) break;
  }

  if (!hooked) {
    // attach from first terminal-ish node as fire-and-forget parallel... better: from last execute
    const candidates = nodes.filter((n) =>
      /publicar|publish|rollback|aplicar|commit|atualizar secret|upsert/i.test(n.name),
    );
    const from = candidates[candidates.length - 1] || nodes[nodes.length - 2];
    if (from) {
      if (!connections[from.name]) connections[from.name] = { main: [[]] };
      if (!connections[from.name].main[0]) connections[from.name].main[0] = [];
      connections[from.name].main[0].push({
        node: 'IA - INVALIDAR CACHE POR EVENTO',
        type: 'main',
        index: 0,
      });
      hooked = true;
      console.log('hook parallel from', from.name, '→ invalidate in', name);
    }
  } else {
    console.log('hook before respond in', name);
  }

  if (!hooked) {
    console.log('WARN could not hook', name);
    continue;
  }

  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,'wire cache invalidate',false,NOW(),NOW())`,
    [versionId, t.id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [nodesJson, connJson, versionId, t.id],
  );
  await client.query('COMMIT');
  console.log('OK', name, versionId);
}

await client.end();
