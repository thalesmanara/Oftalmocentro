import { readFileSync, writeFileSync } from 'fs';

const wf = JSON.parse(
  readFileSync('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/a046016e-b7b0-4c6b-b839-bba18742a194.txt', 'utf8'),
).workflow;

const out = [];
out.push('versionId ' + wf.versionId);
out.push('--- connections ---');
out.push(JSON.stringify(wf.connections, null, 1));
out.push('--- nodes ---');
for (const n of wf.nodes) out.push(n.name + ' | ' + n.type);

out.push('\n--- nodes mentioning policy ---');
for (const n of wf.nodes) {
  const blob = JSON.stringify(n.parameters || {});
  if (/policyMeta|POL[IÍ]TICA|c25ResponsePolicy/i.test(blob)) {
    out.push('\n===== ' + n.name + ' =====');
    out.push(n.parameters.jsCode || JSON.stringify(n.parameters, null, 1));
  }
}
writeFileSync('tmp/post-go-live/_consulta-policy.txt', out.join('\n'), 'utf8');
console.log('written', out.join('\n').length);
