import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [
  'vNDpCzOdR7ATnHDP',
]);
const nodes = rows[0].nodes;
for (const n of nodes) {
  const params = JSON.stringify(n.parameters || {});
  if (
    /embedding|orquestr|promover/i.test(n.name) ||
    (n.type === 'n8n-nodes-base.executeWorkflow' && params.includes('LJQZ2HrG6qJGN0Q2'))
  ) {
    console.log(n.name, n.type, n.parameters?.workflowId?.value || '');
  }
}

// Consulta IA untouched check vs smoke
const { rows: cia } = await c.query(
  `SELECT id, "updatedAt", "activeVersionId" FROM workflow_entity WHERE id=$1`,
  ['8EXk5RkFW5cxnenL'],
);
console.log('Consulta IA', cia[0]);

// Health probe has embeddings
const { rows: health } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [
  'qAyYc9DrHIqe4L9i',
]);
const hq = JSON.stringify(health[0].nodes);
console.log('health has embeddings component?', /embeddings/i.test(hq));

await c.end();
