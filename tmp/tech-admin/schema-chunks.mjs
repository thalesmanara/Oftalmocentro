import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const cols = await c.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='document_chunks' ORDER BY ordinal_position`);
console.log(cols.rows);
await c.end();
