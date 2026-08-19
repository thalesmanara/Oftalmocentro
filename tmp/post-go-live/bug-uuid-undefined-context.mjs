import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire(new URL('../../package.json', import.meta.url));
const { Client } = require('pg');
const c = new Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const docs = (
  await c.query(
    `SELECT id, title, created_at FROM documents WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 8`,
  )
).rows;
const fails = (
  await c.query(
    `SELECT action, success, created_at, left(COALESCE(error_message,''), 350) AS err
     FROM audit_logs
     WHERE created_at > TIMESTAMP '2026-08-01'
       AND (
         COALESCE(error_message,'') ILIKE '%undefined%'
         OR action IN ('DOCUMENT_CREATE','DOCUMENT_CREATE_FAILED')
       )
     ORDER BY created_at DESC
     LIMIT 25`,
  )
).rows;
writeFileSync(
  'tmp/post-go-live/bug-uuid-undefined-context.json',
  JSON.stringify({ docs, fails }, null, 2),
);
console.log(JSON.stringify({ docs, fails }, null, 2));
await c.end();
