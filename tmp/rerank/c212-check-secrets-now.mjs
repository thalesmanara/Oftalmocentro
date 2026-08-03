#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const s = await c.query(
  `SELECT key, value FROM app_secrets WHERE key IN ('retrieval_active_mode','retrieval_active_version','retrieval_config_code','context_active_mode','context_active_version') ORDER BY key`,
);
console.log(s.rows);
const r = await c.query(
  `SELECT version_label, status, mode FROM ai_retrieval_config_versions WHERE status='PUBLISHED'`,
);
console.log('retrieval published', r.rows);
await c.end();
