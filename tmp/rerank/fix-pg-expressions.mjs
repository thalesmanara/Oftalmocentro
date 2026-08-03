#!/usr/bin/env node
/**
 * Fix n8n Postgres queries: '={{ expr }}' becomes '=value' / invalid JSON.
 * Use '{{ expr }}' (legacy string interpolation) like the rest of the project.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const IDS = [
  'RjQDc5gcWFYyBQJO',
  'Ci5BcAlkZCxOxdyA',
  'BAHKNoJM7VdYU8UE',
  'FdaMsXY4nXEO0xV8',
  '12t0Ol6zWQJgAKPC',
  'KdpEmEGHNlPICOa4',
  'sClDEVNVS0TGG2uq',
  '1uITQcJ5jSNXErOM',
  'EdG14rWgluDHiOtt',
  'SxDfJMFCQbytHHL6',
];

function fixQuery(q) {
  if (!q || typeof q !== 'string') return { q, n: 0 };
  // Replace '={{ ... }}' with '{{ ... }}' — careful with nested braces
  let n = 0;
  let out = '';
  let i = 0;
  while (i < q.length) {
    if (q.slice(i, i + 4) === "'={{") {
      // find matching }}'
      let depth = 0;
      let j = i + 4;
      let found = -1;
      while (j < q.length - 1) {
        if (q[j] === '{' && q[j + 1] === '{') {
          depth++;
          j += 2;
          continue;
        }
        if (q[j] === '}' && q[j + 1] === '}') {
          if (depth === 0) {
            found = j;
            break;
          }
          depth--;
          j += 2;
          continue;
        }
        j++;
      }
      if (found > 0 && q[found + 2] === "'") {
        const expr = q.slice(i + 4, found);
        out += "'{{" + expr + "}}'";
        i = found + 3;
        n++;
        continue;
      }
    }
    out += q[i];
    i++;
  }
  return { q: out, n };
}

const report = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) {
    report.push({ id, error: 'missing' });
    continue;
  }
  let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes);
  let total = 0;
  const details = [];
  for (const node of nodes) {
    if (node.type !== 'n8n-nodes-base.postgres') continue;
    const query = node.parameters?.query;
    if (!query || !query.includes("'={{")) continue;
    const { q, n } = fixQuery(query);
    if (n > 0) {
      node.parameters.query = q;
      total += n;
      details.push({ name: node.name, replacements: n, preview: q.slice(0, 200) });
    }
  }
  if (total > 0) {
    await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
      JSON.stringify(nodes),
      id,
    ]);
    if (rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW()
         WHERE "workflowId"=$2 AND "versionId"=$3`,
        [JSON.stringify(nodes), id, rows[0].activeVersionId],
      );
    }
  }
  report.push({ id, name: rows[0].name, total, details });
}

writeFileSync(new URL('./_fix-expr.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await client.end();
