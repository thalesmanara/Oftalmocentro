#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
console.log(
  'secrets',
  (
    await c.query(
      `SELECT key,value FROM app_secrets WHERE key LIKE '%active%' ORDER BY 1`,
    )
  ).rows,
);
console.log(
  'context versions',
  (
    await c.query(
      `SELECT version_label,status,mode FROM ai_context_config_versions
       WHERE status IN ('PUBLISHED','DRAFT') OR version_label LIKE 'context-e2e%'
       ORDER BY status, version_label`,
    )
  ).rows,
);
console.log(
  'retrieval',
  (
    await c.query(
      `SELECT version_label,status,mode FROM ai_retrieval_config_versions WHERE status IN ('PUBLISHED','DRAFT')`,
    )
  ).rows,
);
console.log(
  'published count',
  (await c.query(`SELECT COUNT(*)::int AS n FROM ai_context_config_versions WHERE status='PUBLISHED'`)).rows[0],
);
await c.end();
