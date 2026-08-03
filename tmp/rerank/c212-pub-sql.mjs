#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
for (const id of ['f83073bfb4154115', '708bf587fb73467f']) {
  const { rows } = await c.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => /Promover/i.test(x.name));
  writeFileSync(new URL(`./_c212-${id}-promover.sql`, import.meta.url), n.parameters.query);
  console.log(rows[0].name, 'query len', n.parameters.query.length);
  console.log(n.parameters.query.match(/app_secrets[^;]{0,200}/g));
}
const s = await c.query(`SELECT key, value FROM app_secrets WHERE key ILIKE '%context%' OR key ILIKE 'ai_context%'`);
console.log('context secrets now', s.rows);
const pub = await c.query(`SELECT version_label, mode, status FROM ai_context_config_versions WHERE status='PUBLISHED'`);
console.log('published', pub.rows);
await c.end();
