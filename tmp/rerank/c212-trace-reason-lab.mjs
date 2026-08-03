#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Live Montar catch meta
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const montar = nodes.find((n) => n.name === 'Montar janela');
  writeFileSync(new URL('./_c212-cwm-montar-live.js', import.meta.url), montar.parameters.jsCode);
  const i = montar.parameters.jsCode.indexOf('catch');
  console.log('catch block:\n', montar.parameters.jsCode.slice(i, i + 1200));
}

// Consulta nodes that map contextMeta
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const code = n.parameters?.jsCode || '';
    if (/contextMeta|fallbackReason|fallbackUsed/.test(code)) {
      console.log('\nConsulta node', n.name);
      writeFileSync(new URL(`./_c212-consulta-${n.name.replace(/\W+/g, '_')}.js`, import.meta.url), code);
      const lines = code.split('\n').filter((l) => /contextMeta|fallback/.test(l));
      console.log(lines.slice(0, 40).join('\n'));
    }
  }
}

// EXECUTAR TESTE force wiring
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const blob = JSON.stringify(n.parameters || {});
    if (/forceContext|consulta-ia|jsonBody|Consulta/i.test(blob + n.name)) {
      console.log('\nTESTE', n.name, n.type);
      if (n.parameters?.jsCode && /forceContext|jsonBody/.test(n.parameters.jsCode)) {
        console.log(n.parameters.jsCode.slice(0, 600));
      }
      if (n.parameters?.jsonBody) console.log('jsonBody', String(n.parameters.jsonBody).slice(0, 800));
      if (n.parameters?.workflowInputs?.value) {
        const v = n.parameters.workflowInputs.value;
        console.log('force input', v.forceContextFailureForTest);
        console.log('keys', Object.keys(v).join(','));
      }
    }
  }
}

// run-case webhook
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qVH5qtBf8IY32uiH'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\nrun-case nodes with force:');
  for (const n of nodes) {
    const blob = JSON.stringify(n.parameters || {});
    if (/forceContext|EXECUTAR TESTE|KdpEmEGHNlPICOa4/.test(blob + n.name)) {
      console.log(n.name);
      if (n.parameters?.workflowInputs?.value) {
        console.log('  keys', Object.keys(n.parameters.workflowInputs.value));
        console.log('  force', n.parameters.workflowInputs.value.forceContextFailureForTest);
      }
    }
  }
}

await client.end();
