#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Inspect CWM Montar for force inject
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Montar janela');
  const i = n.parameters.jsCode.indexOf('forceContextFailureForTest');
  console.log('CWM force idx', i);
  console.log(n.parameters.jsCode.slice(i, i + 400));
  // also check entrada normalize
  for (const x of nodes) {
    if (x.parameters?.jsCode?.includes('forceContext') || /normaliz|entrada|trigger/i.test(x.name)) {
      console.log('node', x.name, 'has force', x.parameters?.jsCode?.includes('forceContextFailureForTest'));
    }
  }
}

// Inspect Consulta CWM call inputs
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const cwm = nodes.find((x) => x.name === 'IA - GERENCIAR JANELA DE CONTEXTO');
  console.log('\nConsulta CWM inputs', JSON.stringify(cwm.parameters.workflowInputs?.value, null, 2)?.slice(0, 2500));
}

// Inspect PUBLISH validation
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='f83073bfb4154115'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const blob = (n.parameters?.jsCode || '') + (n.parameters?.query || '');
    if (/VERSION_MISMATCH|validationRun|hybrid|context_config/i.test(blob)) {
      console.log('\nPUBLISH HIT', n.name);
      writeFileSync(
        new URL(`./_c212-pub-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
        blob,
      );
    }
  }
}

// Inspect ROLLBACK params
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='708bf587fb73467f'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    if (n.parameters?.jsCode && /targetVersion|versionId|rollback/i.test(n.parameters.jsCode)) {
      console.log('\nROLLBACK', n.name);
      writeFileSync(
        new URL(`./_c212-rb-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.js`, import.meta.url),
        n.parameters.jsCode,
      );
      console.log(n.parameters.jsCode.slice(0, 500));
    }
  }
}

await client.end();
