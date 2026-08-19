import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const docs = (
  await c.query(
    `SELECT id, title, created_at, sector_id, category_id, subcategory_id, is_active
     FROM documents
     WHERE title ILIKE 'HOTFIX UUID%' OR title ILIKE 'TESTE FIX UUID%'
     ORDER BY created_at DESC
     LIMIT 10`,
  )
).rows;

const execData = (
  await c.query(
    `SELECT ed."executionId", left(ed.data::text, 4000) AS data_head
     FROM execution_data ed
     WHERE ed."executionId" = 54329
     LIMIT 1`,
  )
).rows;

writeFileSync(
  'tmp/post-go-live/bug-uuid-created-rows.json',
  JSON.stringify({ docs, execData }, null, 2),
);
console.log(JSON.stringify({ docs, execLen: execData[0]?.data_head?.length, head: execData[0]?.data_head?.slice(0, 1500) }, null, 2));
await c.end();
