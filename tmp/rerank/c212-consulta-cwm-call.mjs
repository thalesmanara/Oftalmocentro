#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(`SELECT nodes, "versionId", active FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
console.log('Consulta version', rows[0].versionId, 'active', rows[0].active);

for (const n of nodes.filter((x) => x.type === 'n8n-nodes-base.executeWorkflow')) {
  const wf = n.parameters?.workflowId?.value || n.parameters?.workflowId || n.parameters?.source;
  const keys = Object.keys(n.parameters?.workflowInputs?.value || {});
  console.log('\n---', n.name, '---');
  console.log('workflowId:', typeof wf === 'object' ? JSON.stringify(wf) : wf);
  console.log('input keys:', keys.join(', '));
  if (keys.includes('forceContextFailureForTest') || /JANELA|CONTEXTO|GERENCIAR/i.test(n.name)) {
    console.log('force:', n.parameters.workflowInputs.value.forceContextFailureForTest);
    console.log('contextConfigOverrideAllowed:', n.parameters.workflowInputs.value.contextConfigOverrideAllowed);
    console.log('contextConfigVersionId:', n.parameters.workflowInputs.value.contextConfigVersionId);
  }
}

// Also dump CWM trigger schema
const cwm = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
const cnodes = typeof cwm.rows[0].nodes === 'string' ? JSON.parse(cwm.rows[0].nodes) : cwm.rows[0].nodes;
const trig = cnodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger');
writeFileSync(new URL('./_c212-cwm-trigger.json', import.meta.url), JSON.stringify(trig, null, 2));
const values = trig?.parameters?.workflowInputs?.values || trig?.parameters?.inputFields || [];
console.log('\nCWM trigger input fields:');
console.log(JSON.stringify(trig?.parameters, null, 2).slice(0, 4000));

await client.end();
