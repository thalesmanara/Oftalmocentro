#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='e95a92295d7c4deb'`,
);
console.log('active', rows[0].activeVersionId);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
writeFileSync(new URL('./_c212-cwm-conn.json', import.meta.url), JSON.stringify(connections, null, 2));
console.log(JSON.stringify(connections, null, 2).slice(0, 2500));

const montar = nodes.find((n) => n.name === 'Montar janela');
const idx = montar.parameters.jsCode.indexOf('forceContextFailure');
console.log('\nforce block:\n', montar.parameters.jsCode.slice(idx - 100, idx + 450));

// Health: how does it resolve activeVersion?
const healthWf = await client.query(
  `SELECT id, name, nodes FROM workflow_entity WHERE name ILIKE '%health%' AND active=true ORDER BY name LIMIT 10`,
);
console.log('health wfs', healthWf.rows.map((r) => ({ id: r.id, name: r.name })));

await client.end();
