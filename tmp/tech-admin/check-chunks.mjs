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
for (const id of ids) {
  const { rows } = await c.query(
    `SELECT d.processing_status, v.status, v.processing_status AS vps, v.embedding_status, v.qdrant_sync_status,
            length(coalesce(v.extracted_text,'')) AS text_len,
            (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_id=d.id) AS chunks_doc,
            (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks_ver
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  console.log(id.slice(0,8), rows[0]);
}
await c.end();
