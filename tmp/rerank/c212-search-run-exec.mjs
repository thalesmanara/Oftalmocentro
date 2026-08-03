#!/usr/bin/env node
import pg from 'pg';
import zlib from 'zlib';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const runId = '65f45dc5-fe61-4299-9d07-733f1f3ba3e7';

// Search recent dataset executions for this run id in data
const ex = await client.query(
  `SELECT e.id, e.status, e."startedAt"
   FROM execution_entity e
   JOIN execution_data d ON d."executionId" = e.id::text
   WHERE e."workflowId" = '12t0Ol6zWQJgAKPC'
     AND e."startedAt" > NOW() - INTERVAL '2 days'
     AND d.data::text LIKE $1
   ORDER BY e."startedAt" DESC
   LIMIT 5`,
  [`%${runId}%`],
);
console.log('found', ex.rows);

if (!ex.rows[0]) {
  // try without join cast
  const all = await client.query(
    `SELECT id, status, "startedAt" FROM execution_entity
     WHERE "workflowId"='12t0Ol6zWQJgAKPC' AND "startedAt" > NOW() - INTERVAL '2 days'
     ORDER BY "startedAt" DESC LIMIT 20`,
  );
  console.log('recent dataset execs', all.rows);
}

await client.end();
