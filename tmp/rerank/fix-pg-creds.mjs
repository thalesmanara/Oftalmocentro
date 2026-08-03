#!/usr/bin/env node
/**
 * Attach Postgres credential to admin retrieval workflows missing it.
 * Fix empty webhook responses on create/update/publish/rollback.
 */
import pg from 'pg';

const CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const IDS = [
  'RjQDc5gcWFYyBQJO', // create
  'Ci5BcAlkZCxOxdyA', // update
  'BAHKNoJM7VdYU8UE', // publish
  'FdaMsXY4nXEO0xV8', // rollback
  'DesGIYYOTdv0ws9J', // validate (may not need pg)
  'SxDfJMFCQbytHHL6', // list
  'EdG14rWgluDHiOtt', // detail
  'sClDEVNVS0TGG2uq', // load cfg
  'NhWUkmzGhlttJC9S', // validar (code only?)
];

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const report = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) {
    report.push({ id, error: 'missing' });
    continue;
  }
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let changed = 0;
  const before = [];
  for (const n of nodes) {
    if (n.type === 'n8n-nodes-base.postgres') {
      before.push({
        name: n.name,
        hasCred: !!(n.credentials && n.credentials.postgres),
        credId: n.credentials?.postgres?.id,
      });
      if (!n.credentials) n.credentials = {};
      if (!n.credentials.postgres || n.credentials.postgres.id !== CRED.id) {
        n.credentials.postgres = CRED;
        changed++;
      }
    }
  }
  if (changed > 0) {
    await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
      JSON.stringify(nodes),
      id,
    ]);
    if (rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW()
         WHERE "workflowId"=$2 AND "versionId"=$3`,
        [JSON.stringify(nodes), id, rows[0].activeVersionId],
      );
    }
  }
  report.push({ id, name: rows[0].name, postgresNodes: before, changed });
}

console.log(JSON.stringify(report, null, 2));
await client.end();
