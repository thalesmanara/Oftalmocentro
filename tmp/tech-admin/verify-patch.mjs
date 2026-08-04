#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const [id, name] of [
  ['gCEgRsZzch3l7mfD', 'POST'],
  ['z63rJlQKqheFBw4u', 'PUT'],
  ['ukDndCZDzemWsOMk', 'PUT Config'],
  ['DYWXrIK8nGvzzWJ6', 'GET Config'],
]) {
  const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const blob = JSON.stringify(nodes);
  console.log(name, {
    hasTechCol: /is_technical_admin/.test(blob),
    hasSanitize: /Sanitizar privil/.test(blob),
    hasRequiredTech: /requiredTechnicalAdmin/.test(blob),
  });
}
const { rows: u } = await c.query(
  `SELECT email, is_master, is_technical_admin FROM users ORDER BY email`,
);
console.log(u);
await c.end();
