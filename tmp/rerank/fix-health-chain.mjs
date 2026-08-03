#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

// Prepare checks → only storage path (not parallel Qdrant)
connections['Prepare checks'] = {
  main: [[{ node: 'Convert probe to file', type: 'main', index: 0 }]],
};
// Probe OCR → Probe Qdrant → Probe tabular → Aggregate
connections['Probe OCR'] = {
  main: [[{ node: 'Probe Qdrant', type: 'main', index: 0 }]],
};
connections['Probe Qdrant'] = {
  main: [[{ node: 'Probe tabular', type: 'main', index: 0 }]],
};
connections['Probe tabular'] = {
  main: [[{ node: 'Aggregate health', type: 'main', index: 0 }]],
};

// Unwrap Aggregate try/catch if we want clean code — keep catch for safety but ok

await client.query(
  `UPDATE workflow_entity SET connections=$1::json, nodes=$2::json, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(connections), JSON.stringify(nodes), 'qAyYc9DrHIqe4L9i'],
);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET connections=$1::json, nodes=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(connections), JSON.stringify(nodes), 'qAyYc9DrHIqe4L9i', rows[0].activeVersionId],
  );
}
console.log('health chain fixed: OCR → Qdrant → tabular → Aggregate');
await client.end();
