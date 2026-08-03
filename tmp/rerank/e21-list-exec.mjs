#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT id, "workflowId", status, "startedAt", "stoppedAt"
   FROM execution_entity
   WHERE "workflowId" IN ('8EXk5RkFW5cxnenL','bae8872eeb164a27')
   ORDER BY "startedAt" DESC LIMIT 12`,
);
console.log(JSON.stringify(rows, null, 2));
await c.end();
