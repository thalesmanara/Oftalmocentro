import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const cols = await c.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name='ai_retrieval_config_versions' ORDER BY ordinal_position`,
);
console.log(cols.rows.map((r) => r.column_name));

const v2 = (
  await c.query(`SELECT id, retrieval_config_id FROM ai_retrieval_config_versions WHERE version_label='hybrid-v2'`)
).rows[0];

await c.query('BEGIN');
try {
  await c.query(
    `UPDATE ai_retrieval_config_versions SET status='ARCHIVED'
     WHERE status='PUBLISHED' AND retrieval_config_id=$1`,
    [v2.retrieval_config_id],
  );
  await c.query(
    `UPDATE ai_retrieval_config_versions
     SET status='PUBLISHED', published_at=NOW()
     WHERE id=$1`,
    [v2.id],
  );
  await c.query(`UPDATE app_secrets SET value='HYBRID' WHERE key='retrieval_active_mode'`);
  await c.query(`UPDATE app_secrets SET value='hybrid-v2' WHERE key='retrieval_active_version'`);
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
}

const after = await c.query(
  `SELECT version_label, status, published_at FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-v2')`,
);
const secrets = await c.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval_active%' ORDER BY key`,
);

// Check ACTIVATED audit too
const audit = await c.query(
  `SELECT action, created_at FROM audit_logs
   WHERE action IN ('DOCUMENT_ACTIVATED','DOCUMENT_DEACTIVATED')
   ORDER BY created_at DESC LIMIT 5`,
);

writeFileSync(
  'tmp/post-go-live/28-2-hybrid-v2-published.json',
  JSON.stringify({ after: after.rows, secrets: secrets.rows, audit: audit.rows }, null, 2),
);
console.log(JSON.stringify({ after: after.rows, secrets: secrets.rows, audit: audit.rows }, null, 2));
await c.end();
