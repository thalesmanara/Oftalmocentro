#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['FJRbZWYX2pokOa0m', 'P5E43ZXSJiI9wFYD']) {
  const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const ok = nodes.find((n) => /OK/i.test(n.name));
  writeFileSync(
    new URL(`./_ok-${id}.json`, import.meta.url),
    JSON.stringify({ name: ok?.name, parameters: ok?.parameters }, null, 2),
  );
  console.log(id, ok?.name, Object.keys(ok?.parameters || {}));
}
await c.end();
