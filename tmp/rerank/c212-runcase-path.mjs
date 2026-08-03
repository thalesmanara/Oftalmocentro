#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

for (const id of ['qVH5qtBf8IY32uiH', 'wTH2YV6pIlhzWDiY']) {
  const { rows } = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\n', rows[0].name);
  for (const n of nodes) {
    console.log('-', n.name, n.type);
    if (n.parameters?.workflowId || n.parameters?.workflowInputs) {
      console.log('  wf', JSON.stringify(n.parameters.workflowId || n.parameters.workflowInputs).slice(0, 200));
    }
    if (n.parameters?.jsCode && /FAILED|SUCCESS|status|Calcular|finaliz/i.test(n.parameters.jsCode)) {
      writeFileSync(
        new URL(`./_c212-rc-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.js`, import.meta.url),
        n.parameters.jsCode,
      );
      console.log('  wrote code');
    }
  }
}

// Read rest of Agregar sqlUpdateRun - does it set status?
const agg = await import('fs').then((fs) =>
  fs.readFileSync(new URL('./_c212-calc-Agregar_m_tricas.js', import.meta.url), 'utf8'),
);
console.log('\nsqlUpdateRun full:');
const m = agg.match(/sqlUpdateRun[\s\S]*?;/);
console.log(m ? m[0] : 'none');

await client.end();
