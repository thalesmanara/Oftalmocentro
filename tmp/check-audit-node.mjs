import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n' });
await c.connect();
const id = process.argv[2] || 'gCEgRsZzch3l7mfD';
const r = await c.query('SELECT nodes FROM workflow_entity WHERE id = $1', [id]);
const auditNodes = r.rows[0].nodes.filter((n) => n.name.startsWith('Registrar auditoria'));
console.log(JSON.stringify(auditNodes.map((n) => ({ name: n.name, onError: n.onError, alwaysOutputData: n.alwaysOutputData })), null, 2));
await c.end();
