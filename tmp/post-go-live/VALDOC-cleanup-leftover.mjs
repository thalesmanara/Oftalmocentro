import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const id = 'e5f0d409-e0c2-48b2-9480-3bd0cac2a385';
await c.query(
  `UPDATE documents SET current_version_id = NULL, current_version_number = NULL WHERE id = $1`,
  [id],
);
await c.query(`DELETE FROM document_chunks WHERE document_id = $1`, [id]);
await c.query(`DELETE FROM document_versions WHERE document_id = $1`, [id]);
await c.query(`DELETE FROM documents WHERE id = $1`, [id]);
const n = (
  await c.query(
    `SELECT COUNT(*)::int AS n FROM documents
     WHERE title LIKE 'VALDOC%'
        OR title LIKE 'VALDOC2%'
        OR title LIKE 'HOTFIX UUID%'
        OR title LIKE 'MANUAL AMIL TESTE%'`,
  )
).rows[0].n;
console.log('leftovers_after=' + n);
await c.end();
