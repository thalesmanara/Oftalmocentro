import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT id, name, nodes, connections, "activeVersionId", "updatedAt" FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const wf = rows[0];
const nodes = wf.nodes;
const names = nodes.map((n) => ({ name: n.name, type: n.type, pos: n.position }));
writeFileSync(
  new URL('./_consulta-nodes.json', import.meta.url),
  JSON.stringify({ updatedAt: wf.updatedAt, activeVersionId: wf.activeVersionId, names, connections: wf.connections }, null, 2),
);

const merge = nodes.find((n) => n.name === 'Merge híbrido');
const montar = nodes.find((n) => n.name === 'Montar contexto');
const buscar = nodes.find((n) => n.name === 'Buscar chunks relevantes');
const extract = nodes.find((n) => /Extrair vetor|Busca vetorial|Preparar embedding/i.test(n.name));

const dump = {
  mergeCode: merge?.parameters?.jsCode?.slice(0, 8000) || null,
  mergeLen: merge?.parameters?.jsCode?.length || 0,
  montarCode: montar?.parameters?.jsCode?.slice(0, 4000) || null,
  buscarQuery: buscar?.parameters?.query?.slice(0, 1500) || null,
  related: nodes
    .filter((n) => /embed|qdrant|merge|montar|classificar|chunk|busca|vetor/i.test(n.name))
    .map((n) => n.name),
};
writeFileSync(new URL('./_consulta-ranking-dump.json', import.meta.url), JSON.stringify(dump, null, 2));
console.log('nodes', names.map((n) => n.name).join(' | '));
console.log('mergeLen', dump.mergeLen);
console.log('related', dump.related);

// schema signals
const { rows: cols } = await c.query(`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_name IN ('document_chunks','documents','document_versions','ai_test_runs','ai_test_results','ai_test_metrics','app_secrets')
    AND (
      column_name ILIKE '%score%' OR column_name ILIKE '%quality%' OR column_name ILIKE '%chunk%'
      OR column_name ILIKE '%hash%' OR column_name ILIKE '%kind%' OR column_name ILIKE '%sheet%'
      OR column_name ILIKE '%expir%' OR column_name ILIKE '%retrieval%' OR column_name ILIKE '%vector%'
      OR column_name ILIKE '%ocr%' OR column_name ILIKE '%header%' OR column_name ILIKE '%vig%'
    )
  ORDER BY 1,2
`);
writeFileSync(new URL('./_signal-columns.json', import.meta.url), JSON.stringify(cols, null, 2));

const { rows: secrets } = await c.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE 'qdrant%' OR key LIKE 'embedding%' OR key LIKE 'retrieval%' ORDER BY 1`,
);
console.log('secrets', secrets);

const { rows: runs } = await c.query(`
  SELECT id, status, overall_score, total_cases, passed_count, failed_count, duration_ms,
         retrieval_mode, embedding_model, prompt_version, started_at
  FROM ai_test_runs ORDER BY started_at DESC LIMIT 5
`);
console.log('recent runs', runs);

await c.end();
