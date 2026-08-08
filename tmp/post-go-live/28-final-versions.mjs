import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const secrets = (
  await c.query(
    `SELECT key, value FROM app_secrets
     WHERE key ILIKE '%active%' OR key ILIKE 'retrieval%' OR key ILIKE 'prompt%'
        OR key ILIKE 'context%' OR key ILIKE 'cache%' OR key ILIKE 'evidence%'
        OR key ILIKE 'response%'
     ORDER BY key`,
  )
).rows;

const ret = (
  await c.query(
    `SELECT version_label, status, published_at
     FROM ai_retrieval_config_versions
     WHERE version_label IN ('hybrid-v1','hybrid-v2','hybrid-v3')
     ORDER BY version_label`,
  )
).rows;

const prompt = (
  await c.query(
    `SELECT v.version_number, v.status, v.max_tokens
     FROM ai_prompt_versions v
     JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id
     WHERE d.code = 'AI_QUERY_MAIN'
     ORDER BY v.version_number`,
  )
).rows;

const tables = (
  await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public'
       AND (table_name LIKE 'ai_%' OR table_name LIKE '%config%version%')
     ORDER BY 1`,
  )
).rows;

const out = { secrets, ret, prompt, tables };
writeFileSync('tmp/post-go-live/28-final-versions.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
