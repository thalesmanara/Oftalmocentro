import { readFileSync, writeFileSync } from 'fs';

const p = JSON.parse(readFileSync('tmp/post-go-live/28-2-retrieval-patch.json', 'utf8'));
const n = p.nodes.find((x) => x.name === 'Buscar chunks relevantes');
let q = n.parameters.query;
if (q.includes('SELECT term8 FROM params) <>')) {
  console.log('already has term8 scores');
  process.exit(0);
}
const m = q.match(/CASE WHEN \(SELECT term7 FROM params\)[\s\S]*?THEN 15 ELSE 0 END/);
if (!m) {
  console.error('no term7 score');
  process.exit(1);
}
const extra = `${m[0]}
      + CASE WHEN (SELECT term8 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term8 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term8 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term8 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term9 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term9 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term9 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term9 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term10 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term10 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term10 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term10 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term11 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term11 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term11 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term11 FROM params) || '%') THEN 10 ELSE 0 END`;
q = q.replace(m[0], extra);
n.parameters.query = q;
writeFileSync('tmp/post-go-live/28-2-retrieval-patch.json', JSON.stringify(p, null, 2));
console.log('ok');
