import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = rows[0].nodes;
console.log(nodes.map((n) => n.name).join('\n'));
console.log('---CONNECTIONS---');
console.log(JSON.stringify(rows[0].connections, null, 2).slice(0, 4000));
await c.end();
