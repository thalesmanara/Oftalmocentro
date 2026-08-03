const fs = require('fs');
const raw = fs.readFileSync('C:\\Users\\thale\\.cursor\\projects\\c-Revita-Oftalmocentro\\agent-tools\\51ce1525-4503-49e6-bc60-3e3de27986ce.txt', 'utf8');
const obj = JSON.parse(raw);
const wf = obj.workflow;
console.log('NODES:');
for (const n of wf.nodes) {
  console.log(`- ${n.name} :: ${n.type} v${n.typeVersion}`);
}
console.log('\nTRIGGER NODE DETAIL:');
const trig = wf.nodes.find(n => n.type.includes('executeWorkflowTrigger'));
console.log(JSON.stringify(trig, null, 2));
