#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function inflate(data) {
  if (typeof data === 'string') data = JSON.parse(data);
  if (!Array.isArray(data)) return data;
  const resolve = (v, seen = new Set()) => {
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      const i = Number(v);
      if (seen.has(i)) return `[circular ${i}]`;
      seen.add(i);
      return resolve(data[i], seen);
    }
    if (Array.isArray(v)) return v.map((x) => resolve(x, new Set(seen)));
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = resolve(val, new Set(seen));
      return o;
    }
    return v;
  };
  return resolve(data[0]);
}

for (const execId of [11043, 10241, 11139]) {
  const row = await client.query(`SELECT data FROM execution_data WHERE "executionId"=$1`, [
    String(execId),
  ]);
  if (!row.rows[0]) continue;
  const inflated = inflate(row.rows[0].data);
  const err = inflated?.resultData?.error;
  const last = inflated?.resultData?.lastNodeExecuted;
  console.log('\n====', execId, 'last=', last);
  console.log('error', JSON.stringify(err, null, 2)?.slice(0, 2500));
  const runData = inflated?.resultData?.runData || {};
  for (const [name, runs] of Object.entries(runData)) {
    const r0 = Array.isArray(runs) ? runs[0] : null;
    if (r0?.error) {
      console.log('node error', name, JSON.stringify(r0.error).slice(0, 800));
    }
  }
}

await client.end();
