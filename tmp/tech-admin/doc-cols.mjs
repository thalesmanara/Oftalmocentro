import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='documents' AND column_name LIKE '%extract%'`);
console.log(r.rows);
await c.end();
