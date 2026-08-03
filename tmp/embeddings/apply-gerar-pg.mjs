#!/usr/bin/env node
/** Apply GERAR full graph into n8n workflow_entity via local ops + print SQL patch file. */
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import pg from 'pg';

const WF_ID = 'D1bbCBEdKuNQc9F5';
const ops = JSON.parse(readFileSync(new URL('./_ops-gerar.json', import.meta.url), 'utf8')).operations;
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
  [WF_ID]
);
if (!rows[0]) throw new Error('workflow not found');
let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
let connections = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

function ensureConn(src) {
  if (!connections[src]) connections[src] = { main: [] };
  if (!connections[src].main) connections[src].main = [];
}
function addConn(source, target, sourceIndex = 0, targetIndex = 0) {
  ensureConn(source);
  while (connections[source].main.length <= sourceIndex) connections[source].main.push([]);
  const arr = connections[source].main[sourceIndex];
  if (!arr.some((c) => c.node === target && c.index === targetIndex)) {
    arr.push({ node: target, type: 'main', index: targetIndex });
  }
}
function removeConn(source, target, sourceIndex) {
  if (!connections[source]?.main) return;
  if (sourceIndex == null) {
    for (const arr of connections[source].main) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].node === target) arr.splice(i, 1);
    }
  } else if (connections[source].main[sourceIndex]) {
    connections[source].main[sourceIndex] = connections[source].main[sourceIndex].filter((c) => c.node !== target);
  }
}

for (const op of ops) {
  if (op.type === 'removeConnection') {
    removeConn(op.source, op.target, op.sourceIndex);
  } else if (op.type === 'removeNode') {
    nodes = nodes.filter((n) => n.name !== op.nodeName);
    delete connections[op.nodeName];
    for (const src of Object.keys(connections)) {
      if (!connections[src].main) continue;
      connections[src].main = connections[src].main.map((arr) => (arr || []).filter((c) => c.node !== op.nodeName));
    }
  } else if (op.type === 'addNode') {
    const n = op.node;
    nodes.push({
      id: n.id || randomUUID(),
      name: n.name,
      type: n.type,
      typeVersion: n.typeVersion,
      position: n.position || [0, 0],
      parameters: n.parameters || {},
      credentials: n.credentials,
    });
  } else if (op.type === 'addConnection') {
    addConn(op.source, op.target, op.sourceIndex || 0, op.targetIndex || 0);
  } else if (op.type === 'setNodeSettings') {
    const n = nodes.find((x) => x.name === op.nodeName);
    if (!n) throw new Error('missing node ' + op.nodeName);
    Object.assign(n, op.settings);
  } else if (op.type === 'setNodeCredential') {
    const n = nodes.find((x) => x.name === op.nodeName);
    if (!n) throw new Error('missing node ' + op.nodeName);
    n.credentials = n.credentials || {};
    n.credentials[op.credentialKey] = { id: op.credentialId, name: op.credentialName };
  }
}

const res = await client.query(
  `UPDATE workflow_entity SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW() WHERE id = $3`,
  [JSON.stringify(nodes), JSON.stringify(connections), WF_ID]
);
const hist = await client.query(
  `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
   WHERE "workflowId" = $3 AND "versionId" = $4`,
  [JSON.stringify(nodes), JSON.stringify(connections), WF_ID, rows[0].activeVersionId]
);

writeFileSync(
  new URL('./_aplicar-gerar-result.json', import.meta.url),
  JSON.stringify(
    {
      id: WF_ID,
      nodeCount: nodes.length,
      nodeNames: nodes.map((n) => n.name),
      entityUpdated: res.rowCount,
      historyUpdated: hist.rowCount,
      activeVersionId: rows[0].activeVersionId,
    },
    null,
    2
  )
);
console.log(JSON.stringify({ ok: true, nodeCount: nodes.length, names: nodes.map((n) => n.name) }, null, 2));
await client.end();
