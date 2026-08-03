#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Consulta auth node names + force expression
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log(nodes.map((n) => n.name).filter((n) => /auth|normaliz|janela|cwm|gerenciar/i.test(n)).join(', '));
  const cwm = nodes.find((n) => n.name === 'IA - GERENCIAR JANELA DE CONTEXTO');
  console.log('\nforce expr:\n', cwm.parameters.workflowInputs.value.forceContextFailureForTest);
}

// Após carregar config
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of ['Após carregar config', 'Após audit start', 'Carregar context config']) {
    const node = nodes.find((x) => x.name === n);
    if (node?.parameters?.jsCode) {
      writeFileSync(new URL(`./_c212-${n.replace(/\s+/g, '_')}.js`, import.meta.url), node.parameters.jsCode);
      console.log('\n', n, ':\n', node.parameters.jsCode.slice(0, 600));
    }
  }
}

// Health contextWindow section
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const blob = (n.parameters?.jsCode || '') + (n.parameters?.query || '');
    if (/contextWindow|context-v1|ai_context_config/i.test(blob)) {
      console.log('\nHEALTH HIT', n.name);
      writeFileSync(
        new URL(`./_c212-health-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
        blob,
      );
    }
  }
}

await client.end();
