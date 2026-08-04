import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`
  SELECT d.id, d.title, d.processing_status AS d_ps,
         v.id AS vid, v.status AS v_status, v.processing_status AS v_ps,
         v.ocr_status, v.ocr_attempts, v.validation_status,
         length(coalesce(v.extracted_text,'')) AS text_len,
         v.file_path
  FROM documents d
  JOIN document_versions v ON v.id = d.current_version_id
  WHERE d.id IN (
    'a2d13fce-7562-4682-99eb-c48d9ca1655c',
    'b23f6c91-1a54-45ce-bb6a-ed970b667add',
    'e4e8cf29-375f-4e87-bb5c-8d4558a314ff'
  )
`);
console.log(JSON.stringify(rows, null, 2));
// also check if files exist via listing pattern - just show paths
await c.end();
