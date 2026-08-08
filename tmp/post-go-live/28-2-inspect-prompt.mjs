import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const prompts = await c.query(`
SELECT v.version_number, v.status, v.max_tokens, left(v.content, 2500) AS content_head, length(v.content) AS content_len
FROM ai_prompt_versions v
JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
WHERE d.code='AI_QUERY_MAIN'
ORDER BY v.version_number`);
console.log(JSON.stringify(prompts.rows, null, 2));

const pub = await c.query(`
SELECT v.id, v.content, v.max_tokens, v.model_name, v.temperature, v.content_hash
FROM ai_prompt_versions v
JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
WHERE d.code='AI_QUERY_MAIN' AND v.status='PUBLISHED' LIMIT 1`);
const content = pub.rows[0]?.content || '';
const hits = [...content.matchAll(/concis|resum|breve|objetiv|detalh|completo|omit|token|curto|sint[eé]se/gi)].map(
  (m) => m[0],
);
writeFileSync(
  'tmp/post-go-live/28-2-prompt-inspect.json',
  JSON.stringify(
    {
      published: {
        id: pub.rows[0]?.id,
        max_tokens: pub.rows[0]?.max_tokens,
        model: pub.rows[0]?.model_name,
      },
      keywordHits: hits,
      content,
    },
    null,
    2,
  ),
);
console.log('keywords', [...new Set(hits)]);

const secrets = await c.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval%' OR key LIKE 'prompt%'`,
);
console.log('secrets', secrets.rows);

const audit = await c.query(`
SELECT action, created_at, resource_id
FROM audit_logs
WHERE action IN ('DOCUMENT_ACTIVATED','DOCUMENT_DEACTIVATED','AI_RESPONSE_SUMMARY_WARNING_APPLIED')
ORDER BY created_at DESC LIMIT 10`);
console.log('recent audit', audit.rows);

await c.end();
