#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ex = await client.query(
  `SELECT id, status, "startedAt", "stoppedAt"
   FROM execution_entity
   WHERE "workflowId"='12t0Ol6zWQJgAKPC'
     AND "startedAt" >= '2026-08-04 01:40:00+00'
     AND "startedAt" <= '2026-08-04 01:50:00+00'
   ORDER BY "startedAt"`,
);
console.log(ex.rows);

const calc = await client.query(
  `SELECT id, status, "startedAt"
   FROM execution_entity
   WHERE "workflowId"='1uITQcJ5jSNXErOM'
     AND "startedAt" >= '2026-08-04 01:40:00+00'
     AND "startedAt" <= '2026-08-04 01:50:00+00'
   ORDER BY "startedAt"`,
);
console.log('calc', calc.rows);

await client.end();
