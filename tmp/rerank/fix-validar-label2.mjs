#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='NhWUkmzGhlttJC9S'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.name === 'Validar');
let js = n.parameters.jsCode;
const needle =
  "const versionLabel=t.versionLabel!=null?String(t.versionLabel): (body.versionLabel!=null?String(body.versionLabel):null);";
const repl =
  "const versionLabelRaw=t.versionLabel!=null?String(t.versionLabel): (body.versionLabel!=null?String(body.versionLabel):null);\nconst versionLabel=(versionLabelRaw==null||!String(versionLabelRaw).trim())?null:String(versionLabelRaw).trim();";
if (!js.includes(needle)) {
  console.log('needle not found');
  process.exit(1);
}
js = js.replace(needle, repl);
// Also avoid double trim later if present
n.parameters.jsCode = js;
await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='NhWUkmzGhlttJC9S'`, [
  JSON.stringify(nodes),
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='NhWUkmzGhlttJC9S' AND "versionId"=$2`,
    [JSON.stringify(nodes), rows[0].activeVersionId],
  );
}
console.log('fixed empty versionLabel');
await client.end();
