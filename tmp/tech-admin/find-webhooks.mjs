import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const r = await c.query(`
  SELECT id, name, active,
         (nodes::text LIKE '%system/embeddings/reprocess%') AS has_emb_path,
         (nodes::text LIKE '%system/qdrant/reindex%') AS has_qdrant_path
  FROM workflow_entity
  WHERE nodes::text LIKE '%system/embeddings/reprocess%'
     OR nodes::text LIKE '%system/qdrant/reindex%'
  ORDER BY name`);
console.log(r.rows);
await c.end();
