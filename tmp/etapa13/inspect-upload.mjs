import fs from 'fs';

const p =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/df4280c6-9c5e-426c-98be-2677fb610ab2.txt';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
console.log('triggerInfo', String(j.triggerInfo).slice(0, 2500));
const nodes = j.workflow.nodes || [];
console.log(
  'nodes:',
  nodes.map((n) => `${n.name} (${n.type})`).join('\n'),
);
const trigger = nodes.find((n) => /webhook|trigger/i.test(n.type) || n.name.toLowerCase().includes('webhook'));
console.log('\nTRIGGER NODE:', JSON.stringify(trigger?.parameters, null, 2)?.slice(0, 2000));
const exec = nodes.filter(
  (n) =>
    n.type?.includes('executeWorkflow') ||
    /validar|xSEbtkx/i.test(JSON.stringify(n.parameters || {})),
);
for (const n of exec) {
  console.log('\nEXEC NODE', n.name, n.type);
  console.log(JSON.stringify(n.parameters, null, 2).slice(0, 3000));
}
