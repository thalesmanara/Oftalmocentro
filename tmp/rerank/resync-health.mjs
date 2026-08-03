#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
console.log('nodes', nodes.map((n) => n.name));
console.log('activeVersionId', rows[0].activeVersionId);

const hist = await client.query(
  `SELECT nodes FROM workflow_history WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$1`,
  [rows[0].activeVersionId],
);
const hnodes = typeof hist.rows[0].nodes === 'string' ? JSON.parse(hist.rows[0].nodes) : hist.rows[0].nodes;
const hprobe = hnodes.find((n) => n.name === 'Probe database')?.parameters?.query || '';
const eprobe = nodes.find((n) => n.name === 'Probe database')?.parameters?.query || '';
console.log('entity probe has retrieval_mode col', eprobe.includes('retrieval_stats.retrieval_mode'));
console.log('history probe has retrieval_mode col', hprobe.includes('retrieval_stats.retrieval_mode'));
console.log('entity==history probe', eprobe === hprobe);
console.log('history mangled', hprobe.includes('(SELECT COUNT(*)::int   retrieval'));

// Sync history again
await client.query(
  `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
  [JSON.stringify(nodes), JSON.stringify(rows[0].connections), 'qAyYc9DrHIqe4L9i', rows[0].activeVersionId],
);
console.log('synced history');
await client.end();
