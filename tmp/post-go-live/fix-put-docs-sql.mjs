import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

// Clean orphan PROCESSING versions that are not current (leftover from failed PUTs)
const orphans = await c.query(`
  SELECT dv.id, dv.document_id, dv.version_number
  FROM document_versions dv
  WHERE dv.is_current = FALSE
    AND dv.status = 'PROCESSING'
    AND EXISTS (
      SELECT 1 FROM document_versions cur
      WHERE cur.document_id = dv.document_id AND cur.is_current = TRUE
        AND cur.version_number < dv.version_number
    )
`);
console.log('orphans', orphans.rows);
for (const o of orphans.rows) {
  await c.query(`DELETE FROM document_chunks WHERE document_version_id = $1`, [o.id]);
  await c.query(`DELETE FROM document_versions WHERE id = $1`, [o.id]);
  console.log('deleted orphan', o.id, o.version_number);
}

await c.query(`UPDATE documents SET is_active = TRUE WHERE id = '71e5029f-4881-4fe4-9dc9-048f178b1165'`);

let sql = readFileSync('tmp/post-go-live/put-docs-sql-original.txt', 'utf8');
// Fix version allocation
sql = sql.replace(
  'c.version_number + 1,',
  `(SELECT COALESCE(MAX(dv2.version_number), 0) + 1 FROM document_versions dv2 WHERE dv2.document_id = c.document_id),`,
);
// Ensure SELECT includes isActive
if (!sql.includes('"isActive"')) {
  sql = sql.replace(
    'd.expiration_date AS "expirationDate",',
    'd.expiration_date AS "expirationDate",\n  COALESCE(d.is_active, TRUE) AS "isActive",',
  );
}
writeFileSync('tmp/post-go-live/put-docs-sql-fixed.txt', sql);
console.log('fixed sql written', sql.includes('MAX(dv2.version_number)'), sql.includes('"isActive"'));
await c.end();
