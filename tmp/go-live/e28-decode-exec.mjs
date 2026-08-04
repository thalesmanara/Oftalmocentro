#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(`
  SELECT e.id, e.status, e."startedAt", d.data
  FROM execution_entity e
  LEFT JOIN execution_data d ON d."executionId" = e.id
  WHERE e."workflowId"='KdpEmEGHNlPICOa4' AND e.status='error'
  ORDER BY e."startedAt" DESC LIMIT 1`);

const raw = rows[0]?.data;
writeFileSync(new URL('./_exec-sample.json', import.meta.url), typeof raw === 'string' ? raw : JSON.stringify(raw));

function decodeN8n(data) {
  // n8n stores as JSON array with pointer refs sometimes, or object
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { raw: data.slice(0, 500) };
    }
  }
  if (Array.isArray(data)) {
    // format version with strings at end
    const strings = data.filter((x) => typeof x === 'string');
    const errors = strings.filter(
      (s) =>
        /error|Error|fail|permission|403|401|timeout/i.test(s) && s.length < 500,
    );
    return { stringsSample: strings.slice(0, 40), errors: errors.slice(0, 20) };
  }
  return {
    keys: Object.keys(data || {}),
    resultData: data?.resultData?.error || data?.data?.resultData?.error,
  };
}

console.log(JSON.stringify({ id: rows[0]?.id, decoded: decodeN8n(raw) }, null, 2));

// Also check if there's finishedData
const cols = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='execution_entity'`,
);
console.log(
  'exec cols',
  cols.rows.map((r) => r.column_name).filter((n) => /error|msg|data|finish/i.test(n)),
);

await c.end();
