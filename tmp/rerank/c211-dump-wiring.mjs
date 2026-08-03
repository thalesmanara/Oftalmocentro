#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function dump(id, label) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const interesting = nodes
    .filter((n) => /consulta|trigger|prepar|normal|avaliar|carregar|insert|run/i.test(n.name))
    .map((n) => ({
      name: n.name,
      type: n.type,
      inputs: n.parameters?.workflowInputs?.value || null,
      url: n.parameters?.url || null,
      js: (n.parameters?.jsCode || '').slice(0, 800),
      query: (n.parameters?.query || '').slice(0, 400),
    }));
  writeFileSync(new URL(`./_c211-${label}.json`, import.meta.url), JSON.stringify({ name: rows[0].name, names: nodes.map(n=>n.name), interesting }, null, 2));
  console.log(label, nodes.map((n) => n.name).join(' | '));
}

await dump('KdpEmEGHNlPICOa4', 'exec-teste');
await dump('12t0Ol6zWQJgAKPC', 'exec-dataset');
await dump('wTH2YV6pIlhzWDiY', 'run-dataset');
await dump('qVH5qtBf8IY32uiH', 'run-case');
await dump('0289408b8d774379', 'validar-context');
await dump('e95a92295d7c4deb', 'cwm');

await client.end();
