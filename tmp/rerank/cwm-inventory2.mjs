#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const promptCols = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_name IN ('ai_prompt_definitions','ai_prompt_versions')
  ORDER BY table_name, ordinal_position
`);
const prompts = await client.query(`
  SELECT d.code, d.purpose, v.version_number, v.model_name, v.temperature, v.max_tokens, v.status, v.environment,
         LENGTH(COALESCE(v.content,'')) AS content_len
  FROM ai_prompt_versions v
  JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id
  WHERE v.status = 'PUBLISHED'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 5
`).catch(async (e) => {
  const sample = await client.query(`SELECT * FROM ai_prompt_versions LIMIT 1`);
  return { rows: [], error: e.message, sampleKeys: sample.rows[0] ? Object.keys(sample.rows[0]) : [] };
});

const retCfg = await client.query(`SELECT * FROM ai_retrieval_configs LIMIT 1`);
const retVer = await client.query(
  `SELECT configuration FROM ai_retrieval_config_versions WHERE status='PUBLISHED' LIMIT 1`,
);

// Consulta Aplicar prompt + Montar resposta snippets
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const snippets = {};
for (const name of ['Aplicar prompt carregado', 'Aplicar contexto recuperado', 'Montar resposta', 'IA - RECUPERAR CONTEXTO']) {
  const n = nodes.find((x) => x.name === name);
  snippets[name] = n
    ? {
        type: n.type,
        code: n.parameters?.jsCode?.slice(0, 1200) || null,
        inputs: n.parameters?.workflowInputs?.value || null,
      }
    : null;
}

writeFileSync(
  new URL('./_cwm-inventory2.json', import.meta.url),
  JSON.stringify(
    {
      promptCols: promptCols.rows,
      prompts: prompts.rows || prompts,
      retrievalConfig: retCfg.rows[0],
      retrievalPublishedConfig: retVer.rows[0]?.configuration,
      snippets,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ promptCols: promptCols.rows.length, prompts, snippetsKeys: Object.keys(snippets) }, null, 2));
await client.end();
