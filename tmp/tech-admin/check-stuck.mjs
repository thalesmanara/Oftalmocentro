import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const a = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
console.log('counts', a.rows);
const b = await c.query(`
  SELECT d.id, d.title, d.processing_status, d.file_path AS d_fp,
         v.id AS vid, v.processing_status AS vp, v.ocr_status, v.embedding_status,
         v.qdrant_sync_status, v.file_path AS v_fp, length(coalesce(v.extracted_text,'')) AS text_len,
         length(coalesce(d.extracted_text,'')) AS d_text_len
  FROM documents d
  LEFT JOIN document_versions v ON v.id=d.current_version_id
  WHERE d.deleted_at IS NULL
    AND d.processing_status IN ('processing','failed','pending')
  ORDER BY 3,2`);
console.log(JSON.stringify(b.rows, null, 2));
const del = await c.query(`
  SELECT id, title, processing_status, deleted_at
  FROM documents
  WHERE id IN (
    '62601e48-0000-0000-0000-000000000000'::uuid
  ) OR title ILIKE '%7%ALTERA%' OR title ILIKE '%10%ALTERA%' OR title ILIKE '%8%ALTERA%' OR title ILIKE '%9%ALTERA%'
  ORDER BY title`);
console.log('alteracoes', del.rows.map(r => ({id:r.id, title:r.title, st:r.processing_status, del:r.deleted_at})));
await c.end();
