import pg from 'pg';

const client = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const fixes = [
  {
    id: 'LJQZ2HrG6qJGN0Q2',
    swaps: {
      'Contexto ok?': [['Audit STARTED'], ['Erro contexto']],
      'Embedding ok?': [['Audit SUCCESS'], ['Audit FAILED']],
    },
  },
  {
    id: 'x4bw9IQ5vwJSFh0y',
    swaps: {
      'Tem versões?': [['Loop versões'], ['Sem trabalho']],
    },
  },
];

for (const f of fixes) {
  const { rows } = await client.query(
    `SELECT connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
    [f.id]
  );
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  for (const [name, mains] of Object.entries(f.swaps)) {
    connections[name] = {
      main: mains.map((arr) => arr.map((n) => ({ node: n, type: 'main', index: 0 }))),
    };
  }
  await client.query(
    `UPDATE workflow_entity SET connections = $1::json, "updatedAt" = NOW() WHERE id = $2`,
    [JSON.stringify(connections), f.id]
  );
  await client.query(
    `UPDATE workflow_history SET connections = $1::json, "updatedAt" = NOW()
     WHERE "workflowId" = $2 AND "versionId" = $3`,
    [JSON.stringify(connections), f.id, rows[0].activeVersionId]
  );
  console.log('fixed', f.id, f.swaps);
}

await client.end();
