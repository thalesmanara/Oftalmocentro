import { readFileSync, writeFileSync } from 'fs';

const wf = JSON.parse(
  readFileSync('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/a046016e-b7b0-4c6b-b839-bba18742a194.txt', 'utf8'),
).workflow;

const want = ['Montar resposta cache', 'Montar resposta', 'Aplicar validação resposta'];
const out = [];
for (const n of wf.nodes) {
  if (want.includes(n.name)) {
    out.push('===== ' + n.name + ' =====');
    out.push(n.parameters.jsCode || JSON.stringify(n.parameters, null, 1));
    out.push('');
  }
}
writeFileSync('tmp/post-go-live/_consulta-nodes2.txt', out.join('\n'), 'utf8');
console.log('ok');
