import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

// Simulate the WITH chain with fixed values
const q = `
WITH new_document AS (
  INSERT INTO documents (
    title, sector_id, category_id, subcategory_id, semantic_description,
    expiration_date, file_name, file_type, file_size, file_path, extracted_text,
    processing_status, responsible_user_id, created_by, updated_by, is_active
  )
  VALUES (
    'SIMULATE RESPONSE FIX',
    '68af4933-1188-48a6-9743-bd3032cf7a9f'::uuid,
    '1a1b4aa3-fd95-4751-b7b1-ec8066a7185c'::uuid,
    NULL,
    'sim',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'pending',
    NULL,
    NULL,
    NULL,
    TRUE
  )
  RETURNING *
),
new_version AS (
  INSERT INTO document_versions (
    document_id, version_number, is_current, status,
    file_name, file_path, file_size, mime_type,
    title_snapshot, description_snapshot,
    sector_id_snapshot, category_id_snapshot, subcategory_id_snapshot,
    responsible_user_id_snapshot, expiration_date,
    extracted_text, processing_status, created_by, metadata
  )
  SELECT
    d.id, 1, true, 'READY',
    d.file_name, d.file_path, d.file_size, d.file_type,
    d.title, d.semantic_description,
    d.sector_id, d.category_id, d.subcategory_id,
    d.responsible_user_id, d.expiration_date,
    d.extracted_text, 'pending', d.created_by,
    jsonb_build_object('source', 'create')
  FROM new_document d
  RETURNING *
),
linked AS (
  UPDATE documents d
  SET current_version_id = nv.id,
      current_version_number = nv.version_number
  FROM new_version nv
  WHERE d.id = nv.document_id
  RETURNING d.id
)
SELECT
  d.id, d.title,
  COALESCE(d.is_active, TRUE) AS "isActive",
  (SELECT COUNT(*) FROM linked) AS linked_count
FROM documents d
WHERE d.id = (SELECT id FROM linked);
`;

try {
  const r = await c.query(q);
  console.log(JSON.stringify({ rowCount: r.rowCount, rows: r.rows }, null, 2));
  if (r.rows[0]?.id) {
    await c.query(`DELETE FROM document_versions WHERE document_id = $1`, [r.rows[0].id]);
    await c.query(`DELETE FROM documents WHERE id = $1`, [r.rows[0].id]);
  }
} catch (e) {
  console.error('SQL_ERROR', e.message);
}
await c.end();
