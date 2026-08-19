import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const row = (
  await c.query(`SELECT data FROM execution_data WHERE "executionId" = 54329`)
).rows[0];

const raw = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
writeFileSync('tmp/post-go-live/bug-uuid-exec-54329.json', raw);

// Find SQL node output markers
const hasMontar = raw.includes('Montar data');
const hasRespond = raw.includes('Respond to Webhook');
const hasTratar = raw.includes('Tratar erro SQL');
const idx = raw.indexOf('Execute a SQL query');
console.log(
  JSON.stringify(
    {
      len: raw.length,
      hasMontar,
      hasRespond,
      hasTratar,
      snippetAroundSqlStatus: raw.slice(Math.max(0, raw.indexOf('executionStatus')), Math.max(0, raw.indexOf('executionStatus')) + 200),
      lastNode: (raw.match(/lastNodeExecuted":"(\d+)"/) || [])[1],
    },
    null,
    2,
  ),
);

// Manual recreate of final select for inserted doc
const check = (
  await c.query(
    `SELECT d.id, d.title, COALESCE(d.is_active, TRUE) AS is_active
     FROM documents d
     WHERE d.title LIKE 'HOTFIX UUID DUMP%'`,
  )
).rows;
console.log('docs', check);
await c.end();
