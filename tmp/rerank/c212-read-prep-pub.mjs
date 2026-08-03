#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Dump Preparar entrada
{
  const { rows } = await client.query(`SELECT nodes, connections FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const prep = nodes.find((n) => n.name === 'Preparar entrada');
  writeFileSync(new URL('./_c212-cwm-prep.js', import.meta.url), prep.parameters.jsCode);
  console.log(prep.parameters.jsCode);
}

// Dump Avaliar run publish
{
  const fs = await import('fs');
  for (const f of ['_c212-pub-Avaliar_run.txt', '_c212-pub-Avaliar_publish.txt', '_c212-pub-Checar_run_valida_o.txt']) {
    try {
      const t = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
      console.log('\n====', f, '====\n', t.slice(0, 1500));
    } catch (e) {
      console.log('missing', f);
    }
  }
}

await client.end();
