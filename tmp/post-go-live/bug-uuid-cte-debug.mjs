import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const docs = (
  await c.query(
    `SELECT d.id, d.title, d.current_version_id, d.current_version_number,
            (SELECT COUNT(*)::int FROM document_versions v WHERE v.document_id = d.id) AS versions
     FROM documents d
     WHERE d.title ILIKE 'HOTFIX%' OR d.title ILIKE 'SIMULATE%'
     ORDER BY d.created_at DESC`,
  )
).rows;
console.log(JSON.stringify(docs, null, 2));

// Reproduce WITH and inspect each CTE via temporary approach
const q = `
WITH new_document AS (
  INSERT INTO documents (
    title, sector_id, category_id, subcategory_id, semantic_description,
    processing_status, is_active
  ) VALUES (
    'CTE DEBUG', '68af4933-1188-48a6-9743-bd3032cf7a9f'::uuid,
    '1a1b4aa3-fd95-4751-b7b1-ec8066a7185c'::uuid, NULL, 'x', 'pending', TRUE
  ) RETURNING *
),
new_version AS (
  INSERT INTO document_versions (
    document_id, version_number, is_current, status,
    title_snapshot, description_snapshot,
    sector_id_snapshot, category_id_snapshot,
    processing_status, metadata
  )
  SELECT d.id, 1, true, 'READY', d.title, d.semantic_description,
         d.sector_id, d.category_id, 'pending', '{}'::jsonb
  FROM new_document d
  RETURNING id, document_id
),
linked AS (
  UPDATE documents d
  SET current_version_id = nv.id,
      current_version_number = nv.version_number
  FROM new_version nv
  WHERE d.id = nv.document_id
  RETURNING d.id, d.current_version_id
)
SELECT
  (SELECT COUNT(*) FROM new_document) AS docs_cte,
  (SELECT COUNT(*) FROM new_version) AS versions_cte,
  (SELECT COUNT(*) FROM linked) AS linked_cte,
  (SELECT id FROM linked LIMIT 1) AS linked_id
`;

try {
  const r = await c.query(q);
  console.log('cte counts', r.rows);
} catch (e) {
  console.error('err', e.message);
}

// cleanup
await c.query(`
  DELETE FROM document_versions WHERE document_id IN (
    SELECT id FROM documents WHERE title IN ('CTE DEBUG','SIMULATE RESPONSE FIX')
      OR title ILIKE 'HOTFIX%'
  );
  DELETE FROM documents WHERE title IN ('CTE DEBUG','SIMULATE RESPONSE FIX') OR title ILIKE 'HOTFIX%';
`);
await c.end();
