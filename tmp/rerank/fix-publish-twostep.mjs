#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const idx = await client.query(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE tablename='ai_retrieval_config_versions' AND indexname LIKE '%published%';
`);
const cons = await client.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def, condeferrable, condeferred
  FROM pg_constraint
  WHERE conrelid='ai_retrieval_config_versions'::regclass AND conname LIKE '%published%';
`);
console.log(JSON.stringify({ idx: idx.rows, cons: cons.rows }, null, 2));

// Make unique index work with swap: use DEFERRABLE constraint if possible
// Unique partial indexes cannot be deferrable. So we need two statements.
// Test two-step in one connection:
await client.query('BEGIN');
try {
  const draft = await client.query(
    `SELECT id FROM ai_retrieval_config_versions WHERE version_label LIKE 'tmp-pubrb-%' ORDER BY created_at DESC LIMIT 1`,
  );
  const id = draft.rows[0]?.id;
  if (!id) throw new Error('no draft');
  await client.query(
    `UPDATE ai_retrieval_config_versions SET status='ARCHIVED' WHERE status='PUBLISHED' AND retrieval_config_id=(SELECT retrieval_config_id FROM ai_retrieval_config_versions WHERE id=$1)`,
    [id],
  );
  await client.query(
    `UPDATE ai_retrieval_config_versions SET status='PUBLISHED', published_at=NOW() WHERE id=$1`,
    [id],
  );
  await client.query(
    `UPDATE app_secrets SET value=(SELECT mode FROM ai_retrieval_config_versions WHERE id=$1) WHERE key='retrieval_active_mode'`,
    [id],
  );
  await client.query(
    `UPDATE app_secrets SET value=(SELECT version_label FROM ai_retrieval_config_versions WHERE id=$1) WHERE key='retrieval_active_version'`,
    [id],
  );
  console.log('two-step publish OK');
  // immediately rollback to hybrid-v1
  const hybrid = await client.query(
    `SELECT id FROM ai_retrieval_config_versions WHERE version_label='hybrid-v1' LIMIT 1`,
  );
  await client.query(
    `UPDATE ai_retrieval_config_versions SET status='ARCHIVED' WHERE status='PUBLISHED'`,
  );
  await client.query(
    `UPDATE ai_retrieval_config_versions SET status='PUBLISHED', published_at=NOW() WHERE id=$1`,
    [hybrid.rows[0].id],
  );
  await client.query(`UPDATE app_secrets SET value='HYBRID' WHERE key='retrieval_active_mode'`);
  await client.query(`UPDATE app_secrets SET value='hybrid-v1' WHERE key='retrieval_active_version'`);
  await client.query(
    `UPDATE ai_retrieval_config_versions SET status='REJECTED' WHERE id=$1`,
    [id],
  );
  await client.query('COMMIT');
  console.log('restored hybrid-v1');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('FAIL', e.message);
}

await client.end();
