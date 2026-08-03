import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['rHDMICvU4BPvduhf', 'BP5ofN6BV3l3mryJ']) {
  const { rows } = await c.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = rows[0].nodes;
  const pgNode = nodes.find(
    (n) => n.type === 'n8n-nodes-base.postgres' && /SELECT/i.test(n.parameters?.query || ''),
  );
  console.log('\n===', rows[0].name, pgNode?.name, '===');
  console.log(pgNode?.parameters?.query?.slice(0, 2500));
  console.log('has embedding?', /embedding/i.test(pgNode?.parameters?.query || ''));
}
await c.end();
