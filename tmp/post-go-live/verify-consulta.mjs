import { readFileSync } from 'fs';

const before = JSON.parse(
  readFileSync('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/a046016e-b7b0-4c6b-b839-bba18742a194.txt', 'utf8'),
).workflow;
const after = JSON.parse(
  readFileSync('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/95d8cf8a-4faf-4cb8-8293-3546e0f2425a.txt', 'utf8'),
).workflow;

const code = (wf, name) => String((wf.nodes.find((n) => n.name === name) || {}).parameters?.jsCode ?? '');

let failures = 0;
for (const name of ['Aplicar política resposta', 'Aplicar cache save', 'Montar resposta cache']) {
  const b = code(before, name).split('\n');
  const a = code(after, name).split('\n');
  const added = a.filter((l) => !b.includes(l));
  const removed = b.filter((l) => !a.includes(l));
  console.log(`\n===== ${name} =====`);
  console.log('lines before/after:', b.length, '/', a.length);
  console.log('ADDED:');
  added.forEach((l) => console.log('  + ' + l));
  console.log('REMOVED:');
  removed.forEach((l) => console.log('  - ' + l));
  if (removed.length) failures++;
}

// Every other node must be untouched.
console.log('\n===== unintended changes in other nodes =====');
for (const n of before.nodes) {
  const m = after.nodes.find((x) => x.name === n.name);
  if (!m) { console.log('MISSING NODE: ' + n.name); failures++; continue; }
  if (['Aplicar política resposta', 'Aplicar cache save', 'Montar resposta cache'].includes(n.name)) continue;
  if (JSON.stringify(n.parameters) !== JSON.stringify(m.parameters)) {
    console.log('CHANGED: ' + n.name);
    failures++;
  }
}
if (JSON.stringify(before.connections) !== JSON.stringify(after.connections)) {
  console.log('CONNECTIONS CHANGED');
  failures++;
}
console.log(failures === 0 ? '\nOK: only intended additions' : `\nFAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
