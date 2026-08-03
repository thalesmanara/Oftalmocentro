#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const out = { at: new Date().toISOString() };

const wf = await client.query(
  `SELECT id, name, active, "activeVersionId"
   FROM workflow_entity
   WHERE name IN (
     'Consulta IA','IA - RECUPERAR CONTEXTO','IA - CARREGAR PROMPT ATIVO',
     'IA - CARREGAR RETRIEVAL CONFIG','IA - VALIDAR RETRIEVAL CONFIG'
   )
   ORDER BY name`,
);
out.workflows = wf.rows;

const consulta = await client.query(
  `SELECT nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const cNodes =
  typeof consulta.rows[0].nodes === 'string'
    ? JSON.parse(consulta.rows[0].nodes)
    : consulta.rows[0].nodes;
const cConn =
  typeof consulta.rows[0].connections === 'string'
    ? JSON.parse(consulta.rows[0].connections)
    : consulta.rows[0].connections;
out.consultaNames = cNodes.map((n) => n.name);
out.consultaConnections = Object.fromEntries(
  Object.entries(cConn).map(([k, v]) => [
    k,
    (v.main || []).map((b) => (b || []).map((x) => x.node)),
  ]),
);

const recuperar = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='bae8872eeb164a27'`,
);
const rNodes =
  typeof recuperar.rows[0].nodes === 'string'
    ? JSON.parse(recuperar.rows[0].nodes)
    : recuperar.rows[0].nodes;
out.recuperarNames = rNodes.map((n) => n.name);
const montar = rNodes.find((n) => n.name === 'Montar contexto atual');
out.montarSnippet = (montar?.parameters?.jsCode || '').slice(0, 1500);

const promptLoad = await client.query(
  `SELECT nodes FROM workflow_entity WHERE name='IA - CARREGAR PROMPT ATIVO' LIMIT 1`,
);
if (promptLoad.rows[0]) {
  const pNodes =
    typeof promptLoad.rows[0].nodes === 'string'
      ? JSON.parse(promptLoad.rows[0].nodes)
      : promptLoad.rows[0].nodes;
  out.promptLoadNames = pNodes.map((n) => n.name);
}

const tables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND (table_name LIKE 'ai_%' OR table_name LIKE '%context%' OR table_name LIKE '%retrieval%')
  ORDER BY table_name
`);
out.aiTables = tables.rows.map((r) => r.table_name);

const retrievalSchema = await client.query(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name='ai_retrieval_config_versions' ORDER BY ordinal_position
`);
out.retrievalVersionCols = retrievalSchema.rows;

const promptPub = await client.query(`
  SELECT code, purpose, version_number, model_name, temperature, max_tokens, status, environment
  FROM ai_prompt_versions
  WHERE status='PUBLISHED'
  ORDER BY published_at DESC NULLS LAST
  LIMIT 5
`).catch(async (e) => {
  // try alternate schema
  const alt = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name LIKE 'ai_prompt%' ORDER BY table_name, ordinal_position
  `);
  return { rows: [], error: String(e.message), cols: alt.rows };
});
out.publishedPrompts = promptPub.rows || promptPub;

const retPub = await client.query(`
  SELECT id, version_label, mode, status FROM ai_retrieval_config_versions
  WHERE status IN ('PUBLISHED','DRAFT') ORDER BY status, version_label
`);
out.retrievalVersions = retPub.rows;

const testCols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_results' ORDER BY ordinal_position
`);
out.testResultCols = testCols.rows.map((r) => r.column_name);

const chunkStats = await client.query(`
  SELECT
    COUNT(*)::int AS chunks,
    ROUND(AVG(LENGTH(chunk_text)))::int AS avg_chars,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY LENGTH(chunk_text)))::int AS p50_chars,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY LENGTH(chunk_text)))::int AS p90_chars,
    MAX(LENGTH(chunk_text))::int AS max_chars,
    COUNT(*) FILTER (WHERE chunk_kind ILIKE '%tab%')::int AS tabular,
    COUNT(*) FILTER (WHERE chunk_kind ILIKE '%text%' OR chunk_kind IS NULL)::int AS textual
  FROM document_chunks
  WHERE chunk_text IS NOT NULL AND LENGTH(chunk_text) > 0
`).catch((e) => ({ rows: [{ error: e.message }] }));
out.chunkStats = chunkStats.rows[0];

writeFileSync(new URL('./_cwm-inventory.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
