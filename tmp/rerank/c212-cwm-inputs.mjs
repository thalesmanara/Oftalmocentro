#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;

const trigger = nodes.find((n) => n.type === 'n8n-nodes-base.executeWorkflowTrigger' || n.name?.includes('Trigger') || n.type?.includes('executeWorkflowTrigger'));
console.log('trigger', trigger?.name, trigger?.type);
writeFileSync(new URL('./_c212-cwm-trigger.json', import.meta.url), JSON.stringify(trigger, null, 2));

const inputs = trigger?.parameters?.workflowInputs || trigger?.parameters?.inputSource || trigger?.parameters;
console.log('trigger params keys', Object.keys(trigger?.parameters || {}));
console.log(JSON.stringify(trigger?.parameters, null, 2)?.slice(0, 3000));

const montar = nodes.find((n) => n.name === 'Montar janela');
writeFileSync(new URL('./_c212-cwm-montar-live.js', import.meta.url), montar.parameters.jsCode);
const idx = montar.parameters.jsCode.search(/forceContext|__forceSrc|labForce/);
console.log('\nMontar force snippet:\n', montar.parameters.jsCode.slice(Math.max(0, idx - 100), idx + 400));

const apos = nodes.find((n) => n.name === 'Após carregar config');
console.log('\nApós:\n', apos?.parameters.jsCode);

const prep = nodes.find((n) => n.name === 'Preparar entrada');
console.log('\nPrep force lines:\n', prep?.parameters.jsCode?.split('\n').filter((l) => /force|labForce/.test(l)).join('\n'));

await client.end();
