import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const ids = [
  'a2d13fce-7562-4682-99eb-c48d9ca1655c',
  'b23f6c91-1a54-45ce-bb6a-ed970b667add',
  'e4e8cf29-375f-4e87-bb5c-8d4558a314ff',
];

// Soft-delete only if no usable text AND no chunks (true orphans)
for (const id of ids) {
  const { rows } = await c.query(
    `SELECT d.title, d.processing_status,
            length(coalesce(v.extracted_text,'')) AS text_len,
            (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  console.log('before', id.slice(0, 8), rows[0]);
}

await c.query(
  `UPDATE documents
   SET processing_status='processed',
       processed_at=COALESCE(processed_at, NOW()),
       updated_at=NOW()
   WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
  [ids],
);
await c.query(
  `UPDATE document_versions
   SET status='READY',
       processing_status='processed',
       validation_status='VALID',
       validation_error_code=NULL
   WHERE id IN (
     SELECT current_version_id FROM documents WHERE id = ANY($1::uuid[])
   )`,
  [ids],
);

const counts = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
const remaining = await c.query(
  `SELECT id, title, processing_status FROM documents
   WHERE deleted_at IS NULL AND processing_status IN ('processing','failed','pending','error')
   ORDER BY 3,2`,
);
console.log('COUNTS', counts.rows);
console.log('REMAINING', remaining.rows);
await c.end();
