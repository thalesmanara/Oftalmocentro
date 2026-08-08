import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const expired = await c.query(`
SELECT d.id, d.title, d.expiration_date::text AS expiration_date, d.processing_status, d.is_active,
  (SELECT COUNT(*)::int FROM document_chunks dc WHERE dc.document_id=d.id) AS chunks
FROM documents d
WHERE d.deleted_at IS NULL AND d.expiration_date < CURRENT_DATE
ORDER BY d.expiration_date`);
console.log(JSON.stringify({ expiredCount: expired.rows.length, expired: expired.rows }, null, 2));

const prompts = await c.query(`
SELECT v.id, v.version_number, v.status, v.max_tokens
FROM ai_prompt_versions v
JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
WHERE d.code='AI_QUERY_MAIN' ORDER BY v.version_number`);
console.log('prompts', prompts.rows);

const ret = await c.query(`
SELECT id, version_label, status, version_number,
       configuration->'candidateLimit' AS candidate_limit,
       configuration->'finalLimit' AS final_limit,
       configuration->'merge' AS merge,
       configuration->'lexicalExpansion'->'enabled' AS lex_enabled
FROM ai_retrieval_config_versions
WHERE version_label IN ('hybrid-v1','hybrid-v2')`);
console.log('retrieval', ret.rows);

const secrets = await c.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE 'retrieval%' OR key LIKE 'prompt%' OR key LIKE '%active%' ORDER BY key`,
);
console.log('secrets', secrets.rows);

await c.end();
