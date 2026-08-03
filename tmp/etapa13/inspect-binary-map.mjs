import fs from 'fs';

const p =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/df4280c6-9c5e-426c-98be-2677fb610ab2.txt';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const names = [
  'Restaurar request',
  'Validar payload',
  'Anexar binário versão',
  'Avaliar validação',
  'Tratar erro upload',
];
for (const name of names) {
  const n = j.workflow.nodes.find((x) => x.name === name);
  console.log('\n====', name, '====');
  console.log((n?.parameters?.jsCode || JSON.stringify(n?.parameters || {}, null, 2)).slice(0, 4000));
}
