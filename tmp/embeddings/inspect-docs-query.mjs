import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT id, name, nodes FROM workflow_entity WHERE id='WCwJqtFRROwoToik' OR (name ILIKE '%GET Documento%' AND active=true)`,
);
for (const r of rows) {
  const nodes = r.nodes;
  const pgNodes = nodes.filter(
    (n) => n.type === 'n8n-nodes-base.postgres' && /SELECT/i.test(n.parameters?.query || ''),
  );
  for (const n of pgNodes) {
    const q = n.parameters.query || '';
    const hasOcr = /ocr_status/i.test(q);
    const hasEmb = /embedding_status/i.test(q);
    console.log(r.id, r.name, n.name, 'ocr', hasOcr, 'emb', hasEmb, 'len', q.length);
    if (hasOcr && !hasEmb) {
      // find snippet with hasTablePreview or ocr_mode
      const idx = q.indexOf('hasTablePreview');
      console.log('snippet around hasTablePreview:', q.slice(Math.max(0, idx - 80), idx + 200));
    }
  }
}
await c.end();
