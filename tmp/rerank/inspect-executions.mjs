#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, "workflowId", status, "startedAt", "stoppedAt", data
   FROM execution_entity
   WHERE "workflowId" IN ('RjQDc5gcWFYyBQJO','Ci5BcAlkZCxOxdyA','BAHKNoJM7VdYU8UE','wTH2YV6pIlhzWDiY')
   ORDER BY "startedAt" DESC
   LIMIT 6`,
);

const out = rows.map((r) => {
  let data = r.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = { raw: data.slice(0, 200) };
    }
  }
  // n8n stores compressed or structured
  const resultData = data?.resultData || data;
  const error = resultData?.error || null;
  const lastNode = resultData?.lastNodeExecuted;
  const runDataKeys = resultData?.runData ? Object.keys(resultData.runData) : [];
  let nodeErrors = [];
  if (resultData?.runData) {
    for (const [name, runs] of Object.entries(resultData.runData)) {
      for (const run of runs || []) {
        if (run.error) nodeErrors.push({ name, message: run.error.message, description: run.error.description });
      }
    }
  }
  return {
    id: r.id,
    workflowId: r.workflowId,
    status: r.status,
    startedAt: r.startedAt,
    lastNode,
    error: error ? { message: error.message, stack: String(error.stack || '').slice(0, 400) } : null,
    runDataKeys,
    nodeErrors,
  };
});

writeFileSync(new URL('./_exec-errors.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
