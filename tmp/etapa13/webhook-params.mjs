import fs from 'fs';
const p =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/df4280c6-9c5e-426c-98be-2677fb610ab2.txt';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const wh = j.workflow.nodes.find((n) => n.name === 'Webhook');
console.log(JSON.stringify({ typeVersion: wh.typeVersion, parameters: wh.parameters }, null, 2));
