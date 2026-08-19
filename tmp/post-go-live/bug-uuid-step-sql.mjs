import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const leftover = (
  await c.query(`SELECT id, title, current_version_id FROM documents WHERE title = 'SIMULATE RESPONSE FIX'`)
).rows;
console.log('leftover', leftover);

const cols = (
  await c.query(
    `SELECT column_name, is_nullable, column_default, data_type
     FROM information_schema.columns
     WHERE table_name = 'document_versions'
     ORDER BY ordinal_position`,
  )
).rows;
console.log(JSON.stringify(cols, null, 2));

// Step by step
const d = await c.query(
  `INSERT INTO documents (title, sector_id, category_id, semantic_description, processing_status, is_active)
   VALUES ('STEPTEST', '68af4933-1188-48a6-9743-bd3032cf7a9f', '1a1b4aa3-fd95-4751-b7b1-ec8066a7185c', 'x', 'pending', true)
   RETURNING id`,
);
const docId = d.rows[0].id;
console.log('doc', docId);

try {
  const v = await c.query(
    `INSERT INTO document_versions (
      document_id, version_number, is_current, status,
      file_name, file_path, file_size, mime_type,
      title_snapshot, description_snapshot,
      sector_id_snapshot, category_id_snapshot, subcategory_id_snapshot,
      responsible_user_id_snapshot, expiration_date,
      extracted_text, processing_status, created_by, metadata
    ) VALUES (
      $1, 1, true, 'READY',
      NULL, NULL, NULL, NULL,
      'STEPTEST', 'x',
      '68af4933-1188-48a6-9743-bd3032cf7a9f', '1a1b4aa3-fd95-4751-b7b1-ec8066a7185c', NULL,
      NULL, NULL,
      NULL, 'pending', NULL, '{}'::jsonb
    ) RETURNING id`,
    [docId],
  );
  console.log('version', v.rows[0]);
} catch (e) {
  console.error('version_error', e.message);
}

await c.query(`DELETE FROM document_versions WHERE document_id=$1`, [docId]);
await c.query(`DELETE FROM documents WHERE id=$1`, [docId]);
await c.query(`DELETE FROM documents WHERE title='SIMULATE RESPONSE FIX'`);
await c.end();
