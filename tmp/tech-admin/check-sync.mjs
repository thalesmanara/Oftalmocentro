import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
await c.query(`UPDATE users SET is_technical_admin=true WHERE email='compras@oftalmocentrouberaba.com.br'`);
const ids = [
  '55ce423b-b29a-467b-8ba1-7f398651f669',
  '00032b0d-4049-4cd2-bf60-70ba73bf396c',
  'fd9a3665-0ae9-4307-8121-a32a0f344be7',
];
const r = await c.query(
  `SELECT document_version_id,
          COUNT(*)::int total,
          COUNT(*) FILTER (WHERE embedding_status='VALID')::int valid,
          COUNT(*) FILTER (WHERE embedding_sync_status='SYNCED')::int synced,
          COUNT(*) FILTER (WHERE embedding_sync_status='PENDING' OR embedding_sync_status IS NULL)::int pending_sync,
          COUNT(*) FILTER (WHERE embedding_vector IS NOT NULL)::int with_vector
   FROM document_chunks
   WHERE document_version_id = ANY($1::uuid[])
   GROUP BY 1`,
  [ids],
);
console.log(r.rows);

// Check qdrant workflows active
const w = await c.query(
  `SELECT id, name, active FROM workflow_entity
   WHERE name ILIKE '%qdrant%' OR name ILIKE '%embedding%fila%'
   ORDER BY name`,
);
console.log(w.rows);
await c.end();
