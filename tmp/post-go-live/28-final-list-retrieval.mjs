import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const rows = (
  await c.query(`
    SELECT id, version_label, status, mode,
           configuration->>'mode' AS cfg_mode,
           left(configuration::text, 200) AS cfg_head
    FROM ai_retrieval_config_versions
    ORDER BY created_at DESC
    LIMIT 40
  `)
).rows;

writeFileSync('tmp/post-go-live/28-final-retrieval-versions.json', JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
await c.end();
