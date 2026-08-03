#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  writeFileSync(new URL('./_c212-teste-avaliar.js', import.meta.url), n.parameters.jsCode);
  const lines = n.parameters.jsCode.split('\n').filter((l) => /context_fallback|contextFallback|fallbackUsed|contextMeta/.test(l));
  console.log(lines.join('\n'));

  const trig = nodes.find((x) => x.type === 'n8n-nodes-base.executeWorkflowTrigger');
  console.log('\nTESTE trigger inputs', trig?.parameters?.workflowInputs?.values?.map((v) => v.name));
}

await client.end();
