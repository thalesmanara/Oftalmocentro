#!/usr/bin/env node
/**
 * Sync workflow_entity.nodes → workflow_history for patched workflows,
 * then print versionIds for MCP publish.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const IDS = [
  '0289408b8d774379', // VALIDAR
  'e95a92295d7c4deb', // CWM
  'KdpEmEGHNlPICOa4', // EXECUTAR TESTE
  '12t0Ol6zWQJgAKPC', // EXECUTAR DATASET
  'wTH2YV6pIlhzWDiY', // run-dataset
  'qVH5qtBf8IY32uiH', // run-case
  '8EXk5RkFW5cxnenL', // Consulta
  '8f0863b17b844c24', // COMPARE
];

const results = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId", "versionId", active FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) {
    results.push({ id, missing: true });
    continue;
  }
  const row = rows[0];
  const nodesJson = typeof row.nodes === 'string' ? row.nodes : JSON.stringify(row.nodes);
  const connJson =
    typeof row.connections === 'string' ? row.connections : JSON.stringify(row.connections);

  let drift = false;
  if (row.activeVersionId) {
    const h = await client.query(
      `SELECT nodes, connections FROM workflow_history WHERE "workflowId"=$1 AND "versionId"=$2`,
      [id, row.activeVersionId],
    );
    if (h.rows[0]) {
      const hn = typeof h.rows[0].nodes === 'string' ? h.rows[0].nodes : JSON.stringify(h.rows[0].nodes);
      const hc =
        typeof h.rows[0].connections === 'string'
          ? h.rows[0].connections
          : JSON.stringify(h.rows[0].connections);
      drift = hn !== nodesJson || hc !== connJson;
    } else {
      drift = true;
    }
  } else {
    drift = true;
  }

  let versionId = row.activeVersionId || row.versionId;
  if (drift || !versionId) {
    versionId = randomUUID();
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'Etapa 21.1 sync',false,NOW(),NOW())`,
      [versionId, id, nodesJson, connJson, row.name],
    );
    await client.query(
      `UPDATE workflow_entity SET "versionId"=$1::varchar, "activeVersionId"=$1::varchar, "updatedAt"=NOW() WHERE id=$2`,
      [versionId, id],
    );
  }

  results.push({ id, name: row.name, versionId, active: row.active, driftFixed: drift });
}

console.log(JSON.stringify(results, null, 2));

// Verify Avaliar VALUES fragment
const av = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof av.rows[0].nodes === 'string' ? JSON.parse(av.rows[0].nodes) : av.rows[0].nodes;
const code = nodes.find((x) => x.name === 'Avaliar e montar insert').parameters.jsCode;
const colIdx = code.indexOf('insufficient_context, conflict_detected');
console.log('\nCOLUMNS around conflict:\n', code.slice(colIdx, colIdx + 400));
const valMarker = 'contextUtilizationRate == null';
const vIdx = code.indexOf(valMarker);
console.log('\nVALUES around utilization:\n', code.slice(vIdx, vIdx + 700));

await client.end();
