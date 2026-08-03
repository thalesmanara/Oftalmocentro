#!/usr/bin/env node
/** Sync workflow_entity graphs into activeVersion history, then verify. */
import pg from 'pg';
import { writeFileSync } from 'fs';

const IDS = [
  'nivEQHAqHWIwP8P8', // RE-RANQUEAR
  'sClDEVNVS0TGG2uq', // CARREGAR RETRIEVAL CONFIG
  'NhWUkmzGhlttJC9S', // VALIDAR RETRIEVAL CONFIG
  '8EXk5RkFW5cxnenL', // Consulta IA
  'DesGIYYOTdv0ws9J', // validate endpoint
  'RjQDc5gcWFYyBQJO', // create
  'Ci5BcAlkZCxOxdyA', // update
  'BAHKNoJM7VdYU8UE', // publish
  'FdaMsXY4nXEO0xV8', // rollback
  'SxDfJMFCQbytHHL6', // GET list
  'EdG14rWgluDHiOtt', // GET detail
  'KdpEmEGHNlPICOa4', // EXECUTAR TESTE
  '12t0Ol6zWQJgAKPC', // EXECUTAR DATASET
  '1uITQcJ5jSNXErOM', // CALCULAR MÉTRICAS
  'wTH2YV6pIlhzWDiY', // run-dataset webhook
  'qVH5qtBf8IY32uiH', // run-case webhook
];
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const report = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId", active FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  if (!wf) {
    report.push({ id, error: 'missing' });
    continue;
  }
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
  const connections =
    typeof wf.connections === 'string' ? JSON.parse(wf.connections) : wf.connections;
  const names = nodes.map((n) => n.name);
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history
       SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), id, wf.activeVersionId],
    );
  }
  report.push({
    id,
    name: wf.name,
    active: wf.active,
    activeVersionId: wf.activeVersionId,
    nodeCount: nodes.length,
    names,
    hasStub: names.includes('Stub'),
  });
}
writeFileSync(new URL('./_sync-active.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await client.end();
