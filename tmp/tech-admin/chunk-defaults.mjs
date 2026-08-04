import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(`
  SELECT column_name, column_default
  FROM information_schema.columns
  WHERE table_name='document_chunks'
    AND column_name IN ('embedding_status','content_hash','id')`);
console.log(r.rows);
const sample = await c.query(`
  SELECT embedding_status, left(content_hash,20) h, length(chunk_text) n
  FROM document_chunks LIMIT 3`);
console.log('sample', sample.rows);
await c.end();
